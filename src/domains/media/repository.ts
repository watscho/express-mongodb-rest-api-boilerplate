import { Types } from 'mongoose'
import type { ClientSession } from 'mongoose'
import { mediaEnv } from '../../app/config/media.ts'
import { Media } from './model.ts'
import type { StoredImageDto } from './dto.ts'

import { MAX_CONVERSION_BYTES, UPLOAD_LEASE_MS } from './limits.ts'
const ready = {
  $nin: ['uploading', 'deleting'] as ('uploading' | 'deleting')[]
}
const cleanupFilter = (now: Date) => ({
  $or: [
    { status: 'deleting' as const },
    { status: 'uploading' as const, expiresAt: { $lte: now } },
    {
      status: ready,
      refType: { $exists: false },
      refId: { $exists: false },
      updatedAt: {
        $lte: new Date(now.getTime() - mediaEnv.MEDIA_UNUSED_RETENTION_MS)
      }
    }
  ]
})

const imageProjection =
  'owner originalname encoding mimetype destination filename path size'

export const mediaRepository = {
  async usage(owner: string, session: ClientSession) {
    const rows = await Media.aggregate<{ count: number; bytes: number }>([
      { $match: { owner: new Types.ObjectId(owner) } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          bytes: { $sum: { $add: ['$size', MAX_CONVERSION_BYTES] } }
        }
      }
    ])
      .session(session)
      .exec()
    return rows[0] ?? { count: 0, bytes: 0 }
  },
  reserve: (filename: string, owner: string, session: ClientSession) =>
    new Media({
      owner,
      filename,
      path: filename,
      originalname: 'pending',
      encoding: '7bit',
      mimetype: 'image/png',
      destination: '.',
      size: mediaEnv.MAX_UPLOAD_BYTES,
      status: 'uploading',
      expiresAt: new Date(Date.now() + UPLOAD_LEASE_MS)
    }).save({ session }),
  reservation: (filename: string, owner: string) =>
    Media.findOne({
      filename,
      owner,
      status: 'uploading',
      expiresAt: { $gt: new Date() }
    })
      .lean()
      .exec(),
  finalize: (file: StoredImageDto, owner: string, session: ClientSession) =>
    Media.findOneAndUpdate(
      {
        filename: file.filename,
        owner,
        status: 'uploading',
        expiresAt: { $gt: new Date() }
      },
      { $set: { ...file, status: 'ready' }, $unset: { expiresAt: 1 } },
      { session, returnDocument: 'after', runValidators: true }
    ).exec(),
  markFailed: (filename: string, owner: string) =>
    Media.findOneAndUpdate(
      { filename, owner, status: 'uploading' },
      { $set: { status: 'deleting' } },
      { returnDocument: 'after' }
    )
      .lean()
      .exec(),
  removeDeleted: (id: string) =>
    Media.deleteOne({ _id: id, status: 'deleting' }).exec(),
  cleanupCandidates: (now: Date, limit: number) =>
    Media.find(cleanupFilter(now))
      .sort({ updatedAt: 1, _id: 1 })
      .limit(limit)
      .lean()
      .exec(),
  claimCleanup: (id: string, now: Date) =>
    Media.findOneAndUpdate(
      { _id: id, ...cleanupFilter(now) },
      { $set: { status: 'deleting' } },
      { returnDocument: 'after' }
    )
      .lean()
      .exec(),
  hasFilename: (filename: string) => Media.exists({ filename }).exec(),
  create: (image: StoredImageDto, owner: string, session: ClientSession) =>
    new Media({ ...image, owner }).save({ session }),
  getAvatar: (user: string) =>
    Media.findOne({ owner: user, status: ready, refType: 'User', refId: user })
      .select(imageProjection)
      .lean(),
  async existsOwned(
    id: string,
    owner: string,
    session: ClientSession
  ): Promise<boolean> {
    return Boolean(
      await Media.exists({ _id: id, owner, status: ready })
        .session(session)
        .exec()
    )
  },
  listOwned: (owner: string, session: ClientSession) =>
    Media.find({ owner }, imageProjection, { session }).lean(),
  detachAvatar: (owner: string, session: ClientSession) =>
    Media.updateMany(
      { owner, refType: 'User', refId: owner },
      { $unset: { refType: '', refId: '' } },
      { session }
    ),
  attachAvatar: (id: string, owner: string, session: ClientSession) =>
    Media.updateOne(
      { _id: id, owner, status: ready },
      { $set: { refType: 'User', refId: owner } },
      { session, runValidators: true }
    ),
  deleteOwned: (owner: string, session: ClientSession) =>
    Media.updateMany({ owner }, { $set: { status: 'deleting' } }, { session })
}
