import type { JsonWebKey } from 'node:crypto'

export interface IJsonWebKeyPairDoc {
  privateKey: JsonWebKey
  publicKey: JsonWebKey
}
