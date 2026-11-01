import { parseArgs } from 'node:util'
import { writeFile } from 'node:fs/promises'

import { bootstrap } from '../bootstrap.ts'
import { DiagnosticError } from '../diagnostics/errors.ts'

await bootstrap('docs:export', async () => {
  const options = parseArgs({
    options: {
      output: { type: 'string' },
      server: { type: 'string' },
      help: { type: 'boolean', short: 'h' }
    }
  }).values
  if (options.help)
    process.stdout.write(
      'Export OpenAPI without starting services.\n--output <new-file>  Write JSON without overwriting an existing file\n--server <base>      HTTP(S) URL or absolute path; default /\n'
    )
  else {
    const [{ createOpenApiDocument }, { openApiExportOptionsSchema }] =
      await Promise.all([
        import('../../http/documentation/document.ts'),
        import('../../http/documentation/schemas.ts')
      ])
    const parsed = openApiExportOptionsSchema.safeParse(options)
    if (!parsed.success)
      throw new DiagnosticError({
        code: 'CLI_ARGUMENTS_INVALID',
        reason: 'Invalid documentation export options.',
        hint: 'Use --help; choose an output filename and an HTTP(S) base URL or absolute path without credentials/query/fragment.'
      })
    const document =
      JSON.stringify(createOpenApiDocument(parsed.data.server), null, 2) + '\n'
    if (parsed.data.output)
      await writeFile(parsed.data.output, document, { flag: 'wx' })
    else process.stdout.write(document)
  }
})
