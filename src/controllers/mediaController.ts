import { Response } from 'express'
import { ReasonPhrases, StatusCodes } from 'http-status-codes'
import winston from 'winston'

import { mediaService } from '@/services'
import { Image } from '@/infrastructure/image'
import { ContextRequest, UserRequest } from '@/contracts/request'

export const mediaController = {
  imageUpload: async ({ file }: ContextRequest<UserRequest>, res: Response) => {
    try {
      const media = await mediaService.create(file as Express.Multer.File)

      const image = await new Image(media).sharp()

      return res.status(StatusCodes.OK).json({
        data: { id: media.id, image: `${process.env.APP_URL}/${image}` },
        message: ReasonPhrases.OK,
        status: StatusCodes.OK
      })
    } catch (error) {
      winston.error(error)

      await new Image(file as Express.Multer.File).deleteFile()

      return res.status(StatusCodes.BAD_REQUEST).json({
        message: ReasonPhrases.BAD_REQUEST,
        status: StatusCodes.BAD_REQUEST
      })
    }
  }
}
