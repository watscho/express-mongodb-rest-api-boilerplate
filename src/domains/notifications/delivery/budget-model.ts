import { model, Schema } from 'mongoose'

const schema = new Schema(
  {
    _id: { type: String, required: true },
    day: { type: String, required: true },
    used: { type: Number, required: true, min: 0 },
    nextAllowedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true }
  },
  { versionKey: false }
)
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
export const EmailBudget = model('EmailBudget', schema)
