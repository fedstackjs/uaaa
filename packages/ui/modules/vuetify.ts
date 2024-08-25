import { defineNuxtModule } from 'nuxt/kit'
import vuetify from 'vite-plugin-vuetify'

export default defineNuxtModule((options, nuxt) => {
  nuxt.hooks.hook('vite:extendConfig', (config) => {
    config.plugins ??= []
    config.plugins.push(vuetify({ autoImport: true }))
  })
})
