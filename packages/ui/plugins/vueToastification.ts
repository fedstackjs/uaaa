import Toast, { POSITION, type PluginOptions } from 'vue-toastification'
// Import the CSS or use your own!
import 'vue-toastification/dist/index.css'

export default defineNuxtPlugin((app) => {
  app.vueApp.use(Toast, {
    position: POSITION.BOTTOM_RIGHT
  } satisfies PluginOptions)
})
