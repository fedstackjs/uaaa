import { md3 } from 'vuetify/blueprints'

export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },
  ssr: false,
  modules: [
    //
    '@vueuse/nuxt',
    '@unocss/nuxt',
    '@nuxtjs/i18n',
    'vuetify-nuxt-module'
  ],
  runtimeConfig: {
    public: {
      appName: 'UAAA'
    }
  },
  nitro: {
    devProxy: {
      '/api': 'http://localhost:3030/api'
    }
  },
  i18n: {
    langDir: 'locales',
    strategy: 'no_prefix',
    locales: [
      { code: 'en', file: 'en.yml' },
      { code: 'zh-Hans', file: 'zh-Hans.yml', isCatchallLocale: true }
    ]
  },
  vuetify: {
    vuetifyOptions: {
      blueprint: md3,
      icons: {
        defaultSet: 'unocss-mdi'
      }
    }
  }
})
