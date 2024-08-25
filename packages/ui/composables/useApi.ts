import type { IRootApi } from '@uaaa/server'
import { hc } from 'hono/client'

export const useApi = () => {
  const { authToken } = useAppState()
  const authHeaders = computed(() => {
    if (!authToken.value) return {} as Record<string, string>
    return { Authorization: `Bearer ${authToken.value}` }
  })
  const api = hc<IRootApi>('/api/', {
    headers: () => ({
      ...authHeaders.value
    })
  })
  return { api }
}
