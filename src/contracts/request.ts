import { Request } from 'express'
import { ParamsDictionary } from 'express-serve-static-core'
import { Document } from 'mongoose'
import { IUser } from './user'

export interface ContextRequest<T> extends Omit<Request, 'context'> {
  context: T
}

export interface BodyRequest<T> extends Omit<Request, 'body'> {
  body: T
}

export interface ParamsRequest<T> extends Request {
  params: T & ParamsDictionary
}

export interface CombinedRequest<
  Context,
  Body,
  Params = Record<string, unknown>
> extends Pick<ContextRequest<Context>, 'context'>,
    Pick<BodyRequest<Body>, 'body'>,
    Pick<ParamsRequest<Params>, 'params'> {}

export interface UserRequest {
  user: Omit<IUser, 'id'> & Document
  accessToken: string
}
