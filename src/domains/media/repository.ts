import type { ClientSession } from 'mongoose'
import { Media } from './model.ts'
import type { StoredImageDto } from './dto.ts'

const imageProjection =
  'owner originalname encoding mimetype destination filename path size'

export const mediaRepository = {
  create: (image: StoredImageDto, owner: string, session: ClientSession) =>
    new Media({ ...image, owner }).save({ session }),
  getAvatar: (user: string) =>
    Media.findOne({ owner: user, refType: 'User', refId: user })
      .select(imageProjection)
      .lean(),
  async existsOwned(
    id: string,
    owner: string,
    session: ClientSession
  ): Promise<boolean> {
    return Boolean(
      await Media.exists({ _id: id, owner }).session(session).exec()
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
      { _id: id, owner },
      { $set: { refType: 'User', refId: owner } },
      { session, runValidators: true }
    ),
  deleteOwned: (owner: string, session: ClientSession) =>
    Media.deleteMany({ owner }, { session })
}
