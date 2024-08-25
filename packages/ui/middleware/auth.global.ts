export default defineNuxtRouteMiddleware((to, from) => {
  const { isLoggedIn } = useAppState()
  const layout = to.meta.layout ?? 'default'
  if (layout === 'default' && !isLoggedIn.value) return navigateTo('/auth/signin')
})
