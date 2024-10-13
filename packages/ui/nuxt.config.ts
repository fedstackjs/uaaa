import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'

export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },
  ssr: false,
  modules: [
    //
    '@vueuse/nuxt',
    '@unocss/nuxt',
    '@nuxtjs/i18n',
    (_options, nuxt) => {
      nuxt.hooks.hook('vite:extendConfig', (config) => {
        // @ts-expect-error
        config.plugins.push(vuetify({ autoImport: true }))
      })
    }
  ],
  runtimeConfig: {
    public: {
      appName: 'UAAA'
    }
  },
  css: ['@/assets/main.css'],
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
  nitro: {
    devProxy: {
      '/api': 'http://localhost:3030/api',
      '/oauth': 'http://localhost:3030/oauth',
      '/.well-known': 'http://localhost:3030/.well-known'
    }
  },
  i18n: {
    vueI18n: './i18n.config.ts',
    langDir: 'locales',
    strategy: 'no_prefix',
    locales: [
      { code: 'en', file: 'en.yml' },
      { code: 'zh-Hans', file: 'zh-Hans.yml', isCatchallLocale: true }
    ]
  }
})
