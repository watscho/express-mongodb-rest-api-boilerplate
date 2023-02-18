import { Request, Response } from 'express'
import { StatusCodes, ReasonPhrases } from 'http-status-codes'

export const notFoundMiddleware = (_: Request, res: Response) => {
  res
    .status(StatusCodes.NOT_FOUND)
    .json({ message: ReasonPhrases.NOT_FOUND, status: StatusCodes.NOT_FOUND })
}
