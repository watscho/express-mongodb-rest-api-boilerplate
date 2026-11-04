import { mock } from 'node:test'
export const stub = value => mock.fn(async () => value)
export const methods = names =>
  Object.fromEntries(names.map(name => [name, stub()]))
export const replace = (path, namedExports) =>
  mock.module(new URL('../../dist/' + path, import.meta.url), {
    exports: namedExports
  })
export const user = {
  id: 'a'.repeat(24),
  email: 'unit@example.test',
  authVersion: 1,
  verified: false,
  createdAt: new Date(),
  updatedAt: new Date()
}
export const session = { unit: true }
export const database = { transaction: mock.fn(async fn => fn(session)) }
export const logger = methods(['info', 'warn', 'error', 'log'])
export const reset = (...objects) => {
  for (const obj of objects)
    for (const fn of Object.values(obj)) {
      if (fn?.mock) {
        fn.mock.resetCalls()
        fn.mock.restore()
      }
    }
}
export const modelDouble = () => {
  let result = null
  const query = {}
  for (const name of [
    'select',
    'lean',
    'session',
    'sort',
    'limit',
    'maxTimeMS'
  ])
    query[name] = mock.fn(() => query)
  query.exec = mock.fn(async () => {
    if (result instanceof Error) throw result
    return result
  })
  query.then = (resolve, reject) => query.exec().then(resolve, reject)
  const save = mock.fn(async () => result)
  class Model {
    constructor(data) {
      Object.assign(this, data)
    }
    save(...args) {
      return save(...args)
    }
  }
  for (const name of [
    'findById',
    'findOne',
    'find',
    'exists',
    'findOneAndUpdate',
    'findByIdAndUpdate',
    'findOneAndDelete',
    'updateOne',
    'updateMany',
    'deleteOne',
    'deleteMany',
    'countDocuments'
  ])
    Model[name] = mock.fn(() => query)
  return {
    Model,
    query,
    save,
    setResult: value => {
      result = value
    },
    reset: () => {
      result = null
      reset(Model, query, { save })
    }
  }
}
