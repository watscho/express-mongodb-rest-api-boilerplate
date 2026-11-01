import { bootstrap } from './app/runtime/bootstrap.ts'

await bootstrap('api', () => import('./app/runtime/server.ts'))
