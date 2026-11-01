import { AppError } from '../../app/http/errors.ts'
import { imageMimeSchema } from './schemas.ts'
import type {
  OwnedImageRecordDto,
  OwnedImageDto,
  StoredImageDto
} from './dto.ts'

export const toStoredImageDto = (
  file: Express.Multer.File | undefined
): StoredImageDto => {
  if (!file) throw new AppError(400, 'media.image_required')
  const mimetype = imageMimeSchema.safeParse(file.mimetype)
  if (!mimetype.success)
    throw new AppError(400, 'media.unsupported_image_format')
  return {
    originalname: file.originalname,
    encoding: file.encoding,
    mimetype: mimetype.data,
    destination: '.',
    filename: file.filename,
    path: file.filename,
    size: file.size
  }
}

export const toOwnedImageDto = (media: OwnedImageRecordDto): OwnedImageDto => ({
  id: media._id.toString(),
  owner: media.owner.toString(),
  originalname: media.originalname,
  encoding: media.encoding,
  mimetype: imageMimeSchema.parse(media.mimetype),
  destination: media.destination,
  filename: media.filename,
  path: media.path,
  size: media.size
})
