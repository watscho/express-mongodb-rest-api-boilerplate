import { randomUUID } from 'node:crypto'
import multer from 'multer'
import { apiEnv as env } from '../../app/config/api.ts'
import { imageMimeSchema } from './schemas.ts'
import { AppError } from '../../app/http/errors.ts'
import { storageRoot } from './utils.ts'

export const uploadSingleImage = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, storageRoot),
    filename: (_req, _file, callback) => callback(null, randomUUID())
  }),
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1, fields: 0, parts: 2 },
  fileFilter: (_req, file, callback) => {
    if (!imageMimeSchema.options.some(mime => mime === file.mimetype)) {
      callback(new AppError(400, 'media.unsupported_image_format'))
      return
    }
    callback(null, true)
  }
}).single('file')
