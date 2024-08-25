export default defineNuxtRouteMiddleware((to, from) => {
  const { isLoggedIn } = useAppState()
  if (to.meta.layout === 'default' && !isLoggedIn.value) return navigateTo('/auth/signin')
})
