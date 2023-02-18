export declare global {
  namespace Express {
    interface Request {
      context: Context
    }
  }

  namespace NodeJS {
    interface ProcessEnv {
      PORT: number
      ORIGIN: string
      MONGODB_URI: string
      REDIS_URI: string
      REDIS_TOKEN_EXPIRATION: number
      JWT_SECRET: string
      JWT_EXPIRATION: string
      MAIL_HOST: string
      MAIL_PORT: number
      MAIL_USER: string
      MAIL_PASSWORD: string
      MAIL_TPL_PATH: string
      NODE_PATH: string
    }
  }
}
