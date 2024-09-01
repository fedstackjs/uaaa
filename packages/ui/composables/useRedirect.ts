export const useRedirect = () => {
  const router = useRouter()
  const route = useRoute()
  const toSignin = () => router.push({ path: '/auth/signin', query: { redirect: route.fullPath } })
  const toVerify = () => router.push({ path: '/auth/verify', query: { redirect: route.fullPath } })
  return { toSignin, toVerify }
}
