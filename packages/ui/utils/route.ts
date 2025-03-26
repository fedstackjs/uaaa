import type { LocationQueryValue } from '#vue-router'

export const toSingle = (value: LocationQueryValue | LocationQueryValue[], init: string): string =>
  (Array.isArray(value) ? value[0] : value) ?? init
export const toArray = (value: LocationQueryValue | LocationQueryValue[]): string[] =>
  value === null ? [] : Array.isArray(value) ? value.filter((v) => v !== null) : [value]
