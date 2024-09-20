// See: https://stackoverflow.com/a/6511606
export function contrastingColor(color: string) {
  return luma(color) >= 165 ? '000' : 'fff'
}

function luma(color: string) {
  const rgb = hexToRGBArray(color)
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
}

function hexToRGBArray(color: string) {
  color = color.replace(/^#/, '')
  if (color.length === 3) {
    color = `${color[0]}${color[0]}${color[1]}${color[1]}${color[2]}${color[2]}`
  } else if (color.length !== 6) throw new Error('Invalid hex color: ' + color)
  return [
    parseInt(color.slice(0, 2), 16),
    parseInt(color.slice(2, 4), 16),
    parseInt(color.slice(4, 6), 16)
  ]
}

// See: https://stackoverflow.com/a/16348977
export function stringToColor(str: string) {
  const hash = str.split('').reduce((hash, char) => char.charCodeAt(0) + ((hash << 5) - hash), 0)
  let color = '#'
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff
    color += value.toString(16).padStart(2, '0')
  }
  return color
}
