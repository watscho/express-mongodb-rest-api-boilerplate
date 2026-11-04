import { randomUUID } from 'node:crypto'
import { access, mkdir, rename, rm, stat } from 'node:fs/promises'
import sharp from 'sharp'
import { AppError } from '../../app/http/errors.ts'
import { MAX_CONVERSION_BYTES } from './limits.ts'
import { storagePath } from './utils.ts'
import type { StoredImageDto } from './dto.ts'

const AVATAR_SIZE = { width: 150, height: 150 } as const
const INPUT_OPTIONS = {
  limitInputPixels: 40_000_000,
  failOn: 'warning'
} as const

export class Image {
  constructor(private readonly image: StoredImageDto) {}

  private get conversionPath(): string {
    return `conversions/${this.image.filename}_${AVATAR_SIZE.width}x${AVATAR_SIZE.height}.webp`
  }

  async validate() {
    const metadata = await sharp(
      storagePath(this.image.filename),
      INPUT_OPTIONS
    )
      .timeout({ seconds: 30 })
      .metadata()
      .catch(() => {
        throw new AppError(400, 'media.invalid_image')
      })
    const expectedMime =
      metadata.format === 'jpeg'
        ? 'image/jpeg'
        : metadata.format === 'png'
          ? 'image/png'
          : undefined
    if (expectedMime !== this.image.mimetype || (metadata.pages ?? 1) > 1) {
      throw new AppError(400, 'media.unsupported_image_format')
    }
  }

  async resize() {
    const { width, height } = AVATAR_SIZE
    const relativePath = this.conversionPath
    const destination = storagePath(relativePath)
    try {
      await access(destination)
      return relativePath
    } catch (error) {
      if (!(
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ))
        throw error
    }

    await mkdir(storagePath('conversions'), { recursive: true })
    const temporary = storagePath(`conversions/${randomUUID()}.tmp`)
    try {
      await sharp(storagePath(this.image.filename), INPUT_OPTIONS)
        .timeout({ seconds: 30 })
        .rotate()
        .resize(width, height, { fit: 'cover', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(temporary)
      if ((await stat(temporary)).size > MAX_CONVERSION_BYTES)
        throw new AppError(413, 'media.conversion_too_large')
      await rename(temporary, destination)
    } finally {
      await rm(temporary, { force: true })
    }
    return relativePath
  }

  async deleteFile() {
    const results = await Promise.allSettled([
      rm(storagePath(this.image.filename), { force: true }),
      rm(storagePath(this.conversionPath), { force: true })
    ])
    const failure = results.find(result => result.status === 'rejected')
    if (failure?.status === 'rejected') throw failure.reason
  }
}
