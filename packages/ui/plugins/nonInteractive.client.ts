export default defineNuxtPlugin(() => {
  const { config } = useTransparentUX()
  watch(
    config,
    ({ nonInteractive }) => {
      if (!localStorage.getItem('forceInteractive')) {
        const nuxtElement = document.getElementById('__nuxt')!
        nuxtElement.style.opacity = nonInteractive ? '0' : '1'
      }
    },
    { immediate: true }
  )
})
