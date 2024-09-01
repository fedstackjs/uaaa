export default defineNuxtRouteMiddleware((to, from) => {
  if (api.isLoggedIn.value) return navigateTo('/')
})
