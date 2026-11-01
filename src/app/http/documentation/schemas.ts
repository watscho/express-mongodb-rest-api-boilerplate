import { z } from 'zod'
export const packageMetadataSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string(),
  license: z.string(),
  homepage: z.url()
})

export const openApiExportOptionsSchema = z.object({
  output: z.string().min(1).optional(),
  server: z
    .string()
    .min(1)
    .refine(value => {
      try {
        if (!value.startsWith('/') && !/^https?:\/\//.test(value)) return false
        if (value.startsWith('//') || /[\r\n]/.test(value)) return false
        const url = new URL(value, 'https://documentation.invalid')
        return !url.username && !url.password && !url.search && !url.hash
      } catch {
        return false
      }
    }, 'Use an HTTP(S) base URL or absolute path without credentials/query/fragment')
    .optional()
})
