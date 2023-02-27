import { Response } from 'express'
import { ReasonPhrases, StatusCodes } from 'http-status-codes'
import winston from 'winston'

import { mediaService, userService } from '@/services'
import { Image } from '@/infrastructure/image'
import { ContextRequest, UserRequest } from '@/contracts/request'
import { startSession } from 'mongoose'

export const mediaController = {
  imageUpload: async (
    { context: { user }, file }: ContextRequest<UserRequest>,
    res: Response
  ) => {
    const session = await startSession()

    try {
      session.startTransaction()
      const media = await mediaService.create(
        {
          ...(file as Express.Multer.File),
          user: user.id
        },
        session
      )

      await userService.addMediaToUser({ userId: user.id, mediaId: media.id })

      const image = await new Image(media).sharp()

      await session.commitTransaction()
      session.endSession()

      return res.status(StatusCodes.OK).json({
        data: { id: media.id, image },
        message: ReasonPhrases.OK,
        status: StatusCodes.OK
      })
    } catch (error) {
      winston.error(error)

      await new Image(file as Express.Multer.File).deleteFile()

      if (session.inTransaction()) {
        await session.abortTransaction()
        session.endSession()
      }

      return res.status(StatusCodes.BAD_REQUEST).json({
        message: ReasonPhrases.BAD_REQUEST,
        status: StatusCodes.BAD_REQUEST
      })
    }
  }
}
