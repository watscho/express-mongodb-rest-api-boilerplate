import { ObjectId } from 'mongoose'

export interface IJwtUser {
  id: ObjectId
}

export interface IAccessToken {
  accessToken: string
}
