<template>
  <VMenu>
    <template v-slot:activator="{ props }">
      <VBtn v-bind="props" :loading="false" class="text-none">
        {{ dense ? '' : 'thezzisu' }}
      </VBtn>
    </template>
    <VList>
      <VListItem v-for="(link, i) of links" :key="i" v-bind="link" :title="$t(link.title)" />
    </VList>
  </VMenu>
</template>

<script setup lang="ts">
defineProps<{
  dense?: boolean
}>()

const links = [
  { to: '/setting', title: 'pages.setting', prependIcon: 'mdi-account-cog-outline' },
  { to: '/auth/logout', title: 'pages.auth.logout', prependIcon: 'mdi-logout' }
]
</script>
