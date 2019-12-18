const bcrypt = require('bcryptjs')

const mongoose = require('@app/mongoose')

const { Schema } = mongoose

const userSchema = new Schema(
  {
    email: String,
    password: String,
    firstName: String,
    lastName: String,
    locale: String,
    account: {
      verification: {
        verified: {
          type: Boolean,
          default: false
        },
        token: String,
        expiresIn: Date
      },
      resetPassword: {
        token: String,
        expiresIn: Date
      }
    }
  },
  { timestamps: true }
)

userSchema.statics.emailExist = function (email) {
  return this.findOne({ email })
}

userSchema.methods.comparePassword = function (password) {
  return bcrypt.compareSync(password, this.password)
}

const User = mongoose.model('User', userSchema)

module.exports = User
