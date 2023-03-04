import { ClientSession, ObjectId } from 'mongoose'

import { Media } from '@/models'
import { ICreateMediaPayload, IUpdateMediaPayload } from '@/contracts/media'
import { MediaRefType } from '@/constants'

export const mediaService = {
  getById: (mediaId: ObjectId) => Media.findById(mediaId),

  findOneByRef: ({
    refType,
    refId
  }: {
    refType: MediaRefType
    refId: ObjectId
  }) => Media.findOne({ refType, refId }),

  findManyByRef: ({
    refType,
    refId
  }: {
    refType: MediaRefType
    refId: ObjectId
  }) => Media.find({ refType, refId }),

  create: (
    {
      originalname,
      encoding,
      mimetype,
      destination,
      filename,
      path,
      size
    }: ICreateMediaPayload,
    session?: ClientSession
  ) =>
    new Media({
      originalname,
      encoding,
      mimetype,
      destination,
      filename,
      path,
      size
    }).save({ session }),

  updateById: (
    mediaId: ObjectId,
    { refType, refId }: IUpdateMediaPayload,
    session?: ClientSession
  ) => {
    const data = [{ _id: mediaId }, { refType, refId }]

    let params = null

    if (session) {
      params = [...data, { session }]
    } else {
      params = data
    }

    return Media.updateOne(...params)
  },

  deleteById: (mediaId: ObjectId, session?: ClientSession) =>
    Media.deleteOne({ _id: mediaId }, { session }),

  deleteManyByRef: (
    {
      refType,
      refId
    }: {
      refType: MediaRefType
      refId: ObjectId
    },
    session?: ClientSession
  ) => Media.deleteMany({ refType, refId }, { session })
}
