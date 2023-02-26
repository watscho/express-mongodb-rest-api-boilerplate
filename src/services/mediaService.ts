import { ClientSession, ObjectId } from 'mongoose'

import { Media } from '@/models'
import { MediaFileUploadRequest } from '@/contracts/media'

export const mediaService = {
  getById: (mediaId: ObjectId) => Media.findById(mediaId),

  create: (
    {
      originalname,
      encoding,
      mimetype,
      destination,
      filename,
      path,
      size,
      user
    }: MediaFileUploadRequest,
    session?: ClientSession
  ) =>
    new Media({
      originalname,
      encoding,
      mimetype,
      destination,
      filename,
      path,
      size,
      user
    }).save({ session }),

  deleteById: (mediaId: ObjectId, session?: ClientSession) =>
    Media.deleteOne({ _id: mediaId }, { session })
}
