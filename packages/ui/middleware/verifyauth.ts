export default defineNuxtRouteMiddleware((to, from) => {
  if (!api.isLoggedIn.value) {
    return navigateTo({ path: '/auth/signin', query: { redirect: to.fullPath } })
  }
  const requiredLevel = (to.meta.level ?? 1) as number
  const currentLevel = api.effectiveToken.value?.decoded?.level ?? 0
  if (currentLevel < requiredLevel) {
    return navigateTo({
      path: '/auth/verify',
      query: { redirect: to.fullPath, targetLevel: requiredLevel }
    })
  }
})
