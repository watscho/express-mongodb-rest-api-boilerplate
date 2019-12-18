const express = require('express')
const cors = require('cors')
const HttpStatus = require('http-status-codes')

require('module-alias/register')
require('dotenv').config()

require('@app/service/logger')
require('@app/redis')

const { i18next, i18nextMiddleware } = require('@app/i18next')
const authentication = require('@app/middleware/authentication')
const routes = require('@app/route')

const app = express()

app.use(
  express.json(),
  cors({
    origin: process.env.CLIENT_URL,
    optionsSuccessStatus: HttpStatus.OK
  }),
  i18nextMiddleware.handle(i18next),
  authentication,
)

app.use(routes)

app.use('*', (req, res) => {
  res.status(HttpStatus.NOT_FOUND)
    .send('404 Not Found')
})

app.listen(process.env.APP_PORT)
