import { hash } from 'bcrypt'

export const createHash = (string: string) => hash(string, 10)
