const mongoose = require('mongoose')
const winston = require('winston')

mongoose
  .connect(`${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .catch(error => winston.error(error))

mongoose.connection.on('open', () => winston.info('MongoDB connected'))

module.exports = mongoose
