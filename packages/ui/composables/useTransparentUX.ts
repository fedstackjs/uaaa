import type { LocationQuery } from '#vue-router'

export interface ITransparentUXConfig {
  preferType?: string
  nonInteractive?: boolean
}

const serializer = {
  read: JSON.parse,
  write: JSON.stringify
}

const options = { serializer }

const parseTransparentUXConfig = (query: LocationQuery) => {
  const config: ITransparentUXConfig = {}
  if (query.preferType) {
    config.preferType = toSingle(query.preferType, '')
  } else {
    delete config.preferType
  }
  if (query.nonInteractive) {
    config.nonInteractive = ['1', 'true'].includes(toSingle(query.nonInteractive, '1'))
  } else {
    delete config.nonInteractive
  }
  return config
}

const config = useLocalStorage<ITransparentUXConfig>('tux_v0', {}, options)

export const useTransparentUX = () => {
  const route = useRoute()
  const parseAndLoad = (query = route.query) => {
    config.value = parseTransparentUXConfig(query)
  }
  const reset = () => {
    config.value = {}
  }
  const silentFail = () => {
    history.go(1 - history.length)
  }
  return { config, parseAndLoad, reset, silentFail }
}
