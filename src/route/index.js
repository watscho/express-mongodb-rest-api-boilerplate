const express = require('express')

const router = express.Router()

require('@app/route/auth')(router)

module.exports = router
