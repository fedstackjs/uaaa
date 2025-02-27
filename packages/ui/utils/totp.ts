import { renderSVG } from 'uqr'

export function generateTOTPSecret(length = 20) {
  const randomBytes = new Uint8Array(length)
  crypto.getRandomValues(randomBytes)
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let secret = ''
  for (let i = 0; i < randomBytes.length; i += 5) {
    let buffer = 0
    let bufferSize = 0

    for (let j = 0; j < 5 && i + j < randomBytes.length; j++) {
      buffer = (buffer << 8) | randomBytes[i + j]
      bufferSize += 8
    }

    while (bufferSize > 0) {
      bufferSize -= 5
      secret += base32Chars[(buffer >>> bufferSize) & 31]
    }
  }

  return secret
}

const cacheKey = 'cached-totp-secret'

function getIssuer() {
  const iss = api.effectiveToken.value?.decoded.iss ?? ''
  try {
    const url = new URL(iss)
    return url.host
  } catch {}
  return 'UAAA'
}

export async function generateTOTPSecretUrl() {
  if (localStorage.getItem(cacheKey)) {
    try {
      return JSON.parse(localStorage.getItem(cacheKey) ?? '')
    } catch {}
  }
  await api.getSessionClaims()
  const issuer = getIssuer()
  const username = api.claims.value.username?.value ?? 'UAAA User'
  const secret = generateTOTPSecret()
  const label = encodeURIComponent(`${issuer}:${username}`)
  const params = new URLSearchParams({ secret, issuer })
  const url = `otpauth://totp/${label}?${params}`
  const svg = renderSVG(url)
  const svgUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`
  localStorage.setItem(cacheKey, JSON.stringify({ secret, url, svgUrl }))
  return { secret, url, svgUrl }
}

export function clearCachedTOTPSecret() {
  localStorage.removeItem(cacheKey)
}
