import { Router } from 'express'

import { auth } from './auth'
import { users } from './users'

const router: Router = Router()

const routes: {
  [key: string]: (router: Router) => void
} = { auth, users }

for (const route in routes) {
  routes[route](router)
}

export { router }
