import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'UAAA',
  description: 'Unified Authentication And Authorization Framework',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'User Guide', link: '/user-guide' }
    ],

    sidebar: [
      {
        text: 'User Guide',
        link: '/user-guide',
        items: [
          { text: 'Concepts', link: '/concepts' },
          { text: 'Credentials', link: '/credentials' },
          { text: 'Session Management', link: '/session-management' },
          { text: 'Security', link: '/security' }
        ]
      },
      {
        text: 'Getting Started',
        link: '/getting-started',
        items: [
          { text: 'Architecture', link: '/architecture' },
          { text: 'Develop Plugins', link: '/develop-plugins' },
          { text: 'Application Integration', link: '/application-integration' }
        ]
      }
    ]
  }
})
