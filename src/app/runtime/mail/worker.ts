import { bootstrap } from '../bootstrap.ts'

await bootstrap('mail-worker', () => import('./process.ts'))
