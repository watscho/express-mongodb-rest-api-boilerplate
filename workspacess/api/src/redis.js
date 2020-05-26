const Redis = require('ioredis')
const winston = require('winston')

const client = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT
})

client.on('error', error => {
  winston.error(error)
  client.quit()
})

client.on('connect', () => winston.info('Redis client connected'))

module.exports = client
