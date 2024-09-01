export default defineNuxtRouteMiddleware((to, from) => {
  if (!api.isLoggedIn.value) {
    return navigateTo({ path: '/auth/signin', query: { redirect: to.fullPath } })
  }
})
