<template>
  <VNavigationDrawer v-model="model">
    <VList nav>
      <VListItem v-for="(link, i) of links" :key="i" v-bind="link" :title="t(link.title)" />
      <VListGroup v-if="isAdmin" value="Admin">
        <template v-slot:activator="{ props }">
          <VListItem v-bind="{ ...props, ...adminLinks[0] }" :title="t(adminLinks[0].title)" />
        </template>
        <VListItem
          v-for="(link, i) of adminLinks.slice(1)"
          :key="i"
          v-bind="link"
          :title="t(link.title)"
        />
      </VListGroup>
    </VList>
    <template #append>
      <VDivider />
      <div class="flex items-center">
        <VBtn variant="text" class="text-none text-left px-2" color="text" rounded="sm">
          <div>
            <div class="text-sm font-mono tracking-tighter">UAAA-UI</div>
            <div class="text-xs font-mono tracking-tighter mt-[-6px]">v{{ version }}</div>
          </div>
        </VBtn>
        <div class="px-2"></div>
        <div class="flex-1"></div>
        <UiLocaleSelector />
      </div>
    </template>
  </VNavigationDrawer>
</template>

<script setup lang="ts">
import { version } from '~/package.json'

const model = defineModel<boolean>()

const { t } = useI18n()

const links = [
  { to: '/', title: 'pages.index', prependIcon: 'mdi-home' },
  { to: '/session', title: 'pages.session', prependIcon: 'mdi-account-key-outline' },
  { to: '/app', title: 'pages.app', prependIcon: 'mdi-application-cog-outline' },
  { to: '/credential', title: 'pages.credential', prependIcon: 'mdi-shield-key-outline' },
  { to: '/setting', title: 'pages.setting', prependIcon: 'mdi-account-cog-outline' }
]

const adminLinks = [
  { title: 'pages.console.index', prependIcon: 'mdi-console' },
  { to: '/console/user', title: 'pages.console.user' },
  { to: '/console/app', title: 'pages.console.app' },
  { to: '/console/system', title: 'pages.console.setting' }
]

const { isAdmin } = api

console.log(
  `%cUAAA-UI%cVersion%c${version}`,
  'background: #35495e; color: #fff; padding: 2px 4px; border-radius: 4px 0 0 4px',
  'background: #41b883; color: #fff; padding: 2px 4px',
  'background: #35495e; color: #fff; padding: 2px 4px; border-radius: 0 4px 4px 0'
)
</script>
