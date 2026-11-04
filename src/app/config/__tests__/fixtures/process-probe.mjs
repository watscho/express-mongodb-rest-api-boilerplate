import { registerHooks } from 'node:module'
import { ConfigurationError } from '../../../../../dist/app/config/errors.js'
const [mode, role] = process.argv.slice(2)
registerHooks({
  load(url, context, next) {
    if (
      /\/dist\/app\/config\/(?:runtime|database|api|notifications|queue|delivery|mail|media)\.js$/.test(
        url
      ) &&
      mode !== 'success'
    ) {
      if (mode === 'unexpected' && url.endsWith('/runtime.js'))
        throw Error('unexpected')
      throw new ConfigurationError([
        { field: url.split('/').at(-1), code: 'required', reason: 'Required' }
      ])
    }
    return next(url, context)
  }
})
const { loadProcessConfiguration } =
  await import('../../../../../dist/app/config/process.js')
try {
  await loadProcessConfiguration(role)
  process.stdout.write(JSON.stringify({ ok: true }))
} catch (error) {
  process.stdout.write(
    JSON.stringify({
      name: error.name,
      issues: error.issues,
      message: error.message
    })
  )
}
