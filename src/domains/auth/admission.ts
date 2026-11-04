import { createHmac } from 'node:crypto'
import { redis } from '../../app/database/redis.ts'
import { apiEnv } from '../../app/config/api.ts'
import { AppError } from '../../app/http/errors.ts'
import { emailSchema } from '../users/schemas.ts'

// One atomic fixed window across all IPs and replicas. Rejected requests never extend it.
const script = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
if count > tonumber(ARGV[2]) then return math.max(1, redis.call('PTTL', KEYS[1])) end
return 0
`
export const consumeAccountBudget = async (
  email: string,
  operation: 'sign-in' | 'confirmation'
) => {
  const identity = createHmac('sha256', apiEnv.JWT_SECRET)
    .update(emailSchema.parse(email))
    .digest('hex')
  const retry = Number(
    await redis.eval(script, {
      keys: [`security:account:${operation}:${identity}`],
      arguments: [
        String(apiEnv.RATE_LIMIT_WINDOW_MS),
        String(apiEnv.ACCOUNT_RATE_LIMIT_MAX)
      ]
    })
  )
  if (retry > 0)
    throw new AppError(
      429,
      'auth.account_rate_limited',
      undefined,
      Math.ceil(retry / 1000)
    )
}
