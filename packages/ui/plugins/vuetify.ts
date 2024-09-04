import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { md3 } from 'vuetify/blueprints/md3'
import { en, zhHans } from 'vuetify/locale'

export default defineNuxtPlugin((app) => {
  const vuetify = createVuetify({
    blueprint: md3,
    locale: {
      fallback: 'zhHans',
      messages: { en, zhHans }
    },
    icons: {
      sets: {
        svg: {} as never
      }
    }
  })
  app.vueApp.use(vuetify)
})
