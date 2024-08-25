const authToken = useLocalStorage<string | null>('authToken', null)
const isLoggedIn = computed(() => !!authToken.value)

export const useAppState = () => {
  return { authToken, isLoggedIn }
}
