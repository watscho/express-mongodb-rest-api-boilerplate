import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm, access, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { replace } from '../../../__tests__/helpers.mjs'
import { resolveWithinRoot } from '../../../../dist/app/runtime/paths.js'
const root = await mkdtemp(join(tmpdir(), 'unit-images-'))
replace('domains/media/utils.js', {
  storagePath: p => resolveWithinRoot(root, p)
})
const { Image } = await import('../../../../dist/domains/media/image.js')
after(() => rm(root, { recursive: true, force: true }))
test('PNG validates and converts to bounded WebP; repeated resize is cached', async () => {
  await sharp({
    create: { width: 300, height: 200, channels: 3, background: 'red' }
  })
    .png()
    .toFile(join(root, 'png'))
  const image = new Image({ filename: 'png', mimetype: 'image/png' })
  await image.validate()
  const path = await image.resize()
  const meta = await sharp(join(root, path)).metadata()
  assert.equal(meta.width, 150)
  assert.equal(meta.height, 150)
  assert.equal(meta.format, 'webp')
  assert.equal(await image.resize(), path)
  assert(
    !(await readdir(join(root, 'conversions'))).some(p => p.endsWith('.tmp'))
  )
  await image.deleteFile()
  await assert.rejects(() => access(join(root, path)))
  await image.deleteFile()
})
test('JPEG validates without enlarging small inputs', async () => {
  await sharp({
    create: { width: 20, height: 20, channels: 3, background: 'blue' }
  })
    .jpeg()
    .toFile(join(root, 'jpeg'))
  const image = new Image({ filename: 'jpeg', mimetype: 'image/jpeg' })
  await image.validate()
  const p = await image.resize()
  assert.equal((await sharp(join(root, p)).metadata()).width, 20)
})
test('corrupt and missing images are validation failures', async () => {
  await writeFile(join(root, 'bad'), 'not an image')
  for (const filename of ['bad', 'missing'])
    await assert.rejects(
      () => new Image({ filename, mimetype: 'image/png' }).validate(),
      { messageKey: 'media.invalid_image' }
    )
})
test('MIME mismatch rejected', async () => {
  await assert.rejects(
    () => new Image({ filename: 'jpeg', mimetype: 'image/png' }).validate(),
    { messageKey: 'media.unsupported_image_format' }
  )
})
test('unsupported decoded image format is rejected even with PNG MIME', async () => {
  await sharp({
    create: { width: 1, height: 1, channels: 3, background: 'red' }
  })
    .gif()
    .toFile(join(root, 'gif'))
  await assert.rejects(
    () => new Image({ filename: 'gif', mimetype: 'image/png' }).validate(),
    { messageKey: 'media.unsupported_image_format' }
  )
})
