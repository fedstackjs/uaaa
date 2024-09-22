import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'UAAA',
  description: 'Unified Authentication And Authorization Framework',
  locales: {
    root: {
      label: '简体中文',
      lang: 'zh-Hans',
      themeConfig: {
        // https://vitepress.dev/reference/default-theme-config
        nav: [
          { text: '首页', link: '/' },
          { text: '用户指南', link: '/user-guide' }
        ],

        sidebar: [
          {
            text: '用户指南',
            link: '/user-guide',
            items: [
              { text: '基础概念', link: '/concepts' },
              { text: '凭据类型', link: '/credentials' },
              { text: '会话管理', link: '/session-management' },
              { text: '安全措施', link: '/security' }
            ]
          },
          {
            text: '开始使用',
            link: '/getting-started',
            items: [
              { text: '系统架构', link: '/architecture' },
              { text: '插件开发', link: '/develop-plugins' },
              { text: '应用接入', link: '/application-integration' }
            ]
          }
        ]
      }
    },
    en: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        nav: [
          { text: 'Home', link: '/en/' },
          { text: 'User Guide', link: '/en/user-guide' }
        ],

        sidebar: [
          {
            text: 'User Guide',
            link: '/en/user-guide',
            items: [
              { text: 'Concepts', link: '/en/concepts' },
              { text: 'Credentials', link: '/en/credentials' },
              { text: 'Session Management', link: '/en/session-management' },
              { text: 'Security', link: '/en/security' }
            ]
          },
          {
            text: 'Getting Started',
            link: '/en/getting-started',
            items: [
              { text: 'Architecture', link: '/en/architecture' },
              { text: 'Develop Plugins', link: '/en/develop-plugins' },
              { text: 'Application Integration', link: '/en/application-integration' }
            ]
          }
        ]
      }
    }
  }
})
