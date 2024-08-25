import { transformAssetUrls } from 'vite-plugin-vuetify'

export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },
  ssr: false,
  modules: ['@vueuse/nuxt', '@unocss/nuxt', '@nuxtjs/i18n'],
  runtimeConfig: {
    public: {
      appName: 'UAAA'
    }
  },
  build: {
    transpile: ['vuetify']
  },
  vite: {
    vue: {
      template: {
        transformAssetUrls
      }
    }
  },
  i18n: {
    langDir: 'locales',
    strategy: 'no_prefix',
    locales: [
      { code: 'en', file: 'en.yml' },
      { code: 'zh-Hans', file: 'zh-Hans.yml', isCatchallLocale: true }
    ]
  }
})
