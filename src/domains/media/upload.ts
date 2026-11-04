import multer from 'multer'
import type { RequestHandler } from 'express'
import { mediaEnv as env } from '../../app/config/media.ts'
import { imageMimeSchema } from './schemas.ts'
import { AppError } from '../../app/http/errors.ts'
import { storageRoot } from './utils.ts'
import { getAuth } from '../auth/index.ts'
import { mediaService } from './service.ts'

export const uploadSingleImage: RequestHandler = async (req, res, next) => {
  const user = getAuth(res).user
  const filename = await mediaService.reserveUpload(user)
  if (req.destroyed && !req.readableEnded) {
    await mediaService.abandonUpload(filename, user.id)
    next(new AppError(400, 'media.image_required'))
    return
  }
  const writes: Promise<void>[] = []
  const disk = multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, storageRoot),
    filename: (_req, _file, callback) => callback(null, filename)
  })
  let expired = false
  const timer = setTimeout(() => {
    expired = true
    req.destroy(new Error('Upload deadline exceeded'))
  }, 60000)
  timer.unref()
  const receive = multer({
    storage: {
      _handleFile(request, file, callback) {
        let settled!: () => void
        writes.push(
          new Promise<void>(resolve => {
            settled = resolve
          })
        )
        disk._handleFile(request, file, (error, info) => {
          settled()
          callback(error, info)
        })
      },
      _removeFile(request, file, callback) {
        disk._removeFile(request, file, callback)
      }
    },
    limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1, fields: 0, parts: 2 },
    fileFilter: (_req, file, callback) => {
      if (!imageMimeSchema.options.some(mime => mime === file.mimetype)) {
        callback(new AppError(400, 'media.unsupported_image_format'))
        return
      }
      callback(null, true)
    }
  }).single('file')
  receive(req, res, error => {
    clearTimeout(timer)
    if (error || !req.file || expired || (req.destroyed && !req.complete)) {
      // Multer can report an abort before a pending disk writer finishes.
      // Keep its quota charged until every storage callback has settled.
      void Promise.all(writes)
        .then(() => mediaService.abandonUpload(filename, user.id))
        .then(
          () => next(error ?? new AppError(400, 'media.image_required')),
          next
        )
      return
    }
    next()
  })
}
