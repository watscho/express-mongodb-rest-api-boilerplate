import { operation } from '../../app/http/documentation/utils.ts'
import type { OpenApiPathsDto } from '../../app/http/documentation/dto.ts'
import {
  imageMimeSchema,
  updateAvatarSchema,
  uploadImageResponseSchema
} from './schemas.ts'
export const createMediaDocumentation = (): OpenApiPathsDto => ({
  '/media/image/upload': {
    post: operation({
      operationId: 'uploadImage',
      summary: 'Upload an owned image',
      description:
        'Upload exactly one file part and no extra form fields. Only single-frame JPEG/PNG images are accepted after decoding; unsupported MIME types, invalid images, and MIME/content mismatches return 400. The API generates an orientation-aware 150×150 WebP conversion. Originals remain private; the returned image ID belongs to the uploader. The byte limit is configured with MAX_UPLOAD_BYTES (10 MiB by default); oversized files return 413.',
      tag: 'Media',
      access: 'authenticated',
      response: uploadImageResponseSchema,
      messageKey: 'media.image_uploaded',
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['file'],
              additionalProperties: false,
              properties: {
                file: {
                  type: 'string',
                  format: 'binary',
                  description:
                    'One JPEG or PNG file; decoded content must match.'
                }
              }
            },
            encoding: {
              file: { contentType: imageMimeSchema.options.join(', ') }
            }
          }
        }
      }
    })
  },
  '/user/update/avatar': {
    post: operation({
      operationId: 'updateAvatar',
      summary: 'Attach an owned image as avatar',
      description:
        'The image must have been uploaded by this account. Detaches the previous avatar without deleting its image, allowing reuse.',
      tag: 'Media',
      access: 'authenticated',
      body: updateAvatarSchema,
      messageKey: 'media.avatar_updated',
      errors: [404]
    })
  }
})
