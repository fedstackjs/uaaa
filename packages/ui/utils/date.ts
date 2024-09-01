export const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp)
  return date.toLocaleString()
}
