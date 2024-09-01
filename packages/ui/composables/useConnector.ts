import type { Connector } from '~/utils/connector'

export const useConnector = (type: string): Connector | unknown => {
  try {
    switch (type) {
      case 'oidc':
        return new OpenIDConnector()
    }
    return new Error('Invalid connector type')
  } catch (err) {
    return err
  }
}
