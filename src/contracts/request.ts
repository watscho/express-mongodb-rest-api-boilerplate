import { Request } from 'express'
import { ParamsDictionary } from 'express-serve-static-core'
import { Document } from 'mongoose'

import { IUser } from './user'

export interface IContextRequest<T> extends Omit<Request, 'context'> {
  context: T
}

export interface IBodyRequest<T> extends Omit<Request, 'body'> {
  body: T
}

export interface IParamsRequest<T> extends Request {
  params: T & ParamsDictionary
}

export interface IQueryRequest<T> extends Request {
  query: T & ParamsDictionary
}

export interface ICombinedRequest<
  Context,
  Body,
  Params = Record<string, unknown>,
  Query = Record<string, unknown>
> extends Pick<IContextRequest<Context>, 'context'>,
    Pick<IBodyRequest<Body>, 'body'>,
    Pick<IParamsRequest<Params>, 'params'>,
    Pick<IQueryRequest<Query>, 'query'> {}

export interface IUserRequest {
  user: Omit<IUser, 'id'> & Document
  accessToken: string
}
