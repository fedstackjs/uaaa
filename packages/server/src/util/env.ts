export function snakeToCamel(s: string) {
  return s.toLowerCase().replace(/([-_][a-z])/gi, ($1) => {
    return $1.toUpperCase().replace('-', '').replace('_', '')
  })
}

export function envToConfig() {
  return Object.fromEntries(
    Object.entries(process.env).map(([key, value]) => [snakeToCamel(key), value])
  )
}
