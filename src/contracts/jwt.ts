import { ObjectId } from 'mongoose'

export interface JwtUser {
  id: ObjectId
}

export interface AccessToken {
  accessToken: string
}
