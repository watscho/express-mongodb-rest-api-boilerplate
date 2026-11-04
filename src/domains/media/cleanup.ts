import { opendir, stat, rm } from 'node:fs/promises'
import { mediaEnv } from '../../app/config/media.ts'
import { mediaRepository } from './repository.ts'
import { Image } from './image.ts'
import { toOwnedImageDto } from './transformer.ts'
import { storageRoot, storagePath } from './utils.ts'

// Claiming a record writes the same document as avatar attachment, fencing concurrent reuse.
export const cleanupUnusedMedia = async (limit = 100) => {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000)
    throw new Error('Cleanup limit must be between 1 and 1000')
  const now = new Date()
  let deleted = 0
  let failed = 0
  for (const candidate of await mediaRepository.cleanupCandidates(now, limit)) {
    const claimed = await mediaRepository.claimCleanup(
      candidate._id.toString(),
      now
    )
    if (!claimed) continue
    try {
      await new Image(toOwnedImageDto(claimed)).deleteFile()
      await mediaRepository.removeDeleted(claimed._id.toString())
      deleted++
    } catch {
      failed++
    } // Keep the deletion marker and quota charge for the next run.
  }
  // Recover crash leftovers without touching unknown/legacy filenames or live records.
  let orphaned = 0
  for (const directory of ['', 'conversions']) {
    let entries
    try {
      entries = await opendir(directory ? storagePath(directory) : storageRoot)
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
        continue
      throw error
    }
    for await (const entry of entries) {
      if (orphaned >= limit) break
      const match =
        /^([a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12})(?:_150x150\.webp|\.tmp)?$/.exec(
          entry.name
        )
      if (!entry.isFile() || !match) continue
      const path = storagePath(
        directory ? `${directory}/${entry.name}` : entry.name
      )
      try {
        if (
          (await stat(path)).mtimeMs >
          now.getTime() - mediaEnv.MEDIA_UNUSED_RETENTION_MS
        )
          continue
        if (await mediaRepository.hasFilename(match[1]!)) continue
        await rm(path, { force: true })
        orphaned++
      } catch {
        failed++
      }
    }
  }
  return { deleted, orphaned, failed }
}
