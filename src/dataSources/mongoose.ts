import { connect, connection } from 'mongoose'
import winston from 'winston'

export const mongoose = {
  run: async () => {
    try {
      return await connect(process.env.MONGODB_URI)
    } catch (error) {
      winston.error(error)
    }
  },

  stop: async () => {
    try {
      return await connection.destroy()
    } catch (error) {
      winston.error(error)
    }
  }
}
