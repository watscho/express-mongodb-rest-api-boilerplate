import { Model, ObjectId } from 'mongoose'

export interface IMedia {
  originalname: string
  encoding: string
  mimetype: string
  destination: string
  filename: string
  path: string
  size: number
  orderColumn?: number
  refType?: string
  refId?: ObjectId
}

export type CreateMediaPayload = Omit<
  IMedia,
  'refId' | 'refType' | 'orderColumn'
>

export type UpdateMediaPayload = Pick<IMedia, 'refId' | 'refType'>

export type MediaModel = Model<IMedia>
