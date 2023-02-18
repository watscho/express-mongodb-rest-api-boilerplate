import { configure, format, transports } from 'winston'

configure({
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.json()
  ),
  transports: [new transports.File({ filename: process.env.API_LOG_FILENAME })]
})
