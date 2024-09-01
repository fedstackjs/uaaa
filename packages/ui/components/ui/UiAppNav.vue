<template>
  <VNavigationDrawer v-model="model">
    <VList nav>
      <VListItem v-for="(link, i) of links" :key="i" v-bind="link" :title="t(link.title)" />
      <VListGroup value="Users">
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
            <div class="text-sm font-mono tracking-tighter">UAAA</div>
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
const model = defineModel<boolean>()

const { t } = useI18n()

const links = [
  { to: '/', title: 'pages.index', prependIcon: 'i-mdi:home' },
  { to: '/session', title: 'pages.session', prependIcon: 'i-mdi:account-key-outline' },
  { to: '/app', title: 'pages.app', prependIcon: 'i-mdi:application-cog-outline' },
  { to: '/credential', title: 'pages.credential', prependIcon: 'i-mdi:shield-key-outline' },
  { to: '/setting', title: 'pages.setting', prependIcon: 'i-mdi:account-cog-outline' }
]

const adminLinks = [
  { to: '/console', title: 'pages.console.index', prependIcon: 'i-mdi:console' },
  { to: '/console/user', title: 'pages.console.user' },
  { to: '/console/app', title: 'pages.console.app' },
  { to: '/console/setting', title: 'pages.console.setting' }
]
</script>
