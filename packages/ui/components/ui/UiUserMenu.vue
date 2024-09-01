<template>
  <VBtn
    v-if="!dense"
    prepend-icon="i-mdi:security"
    class="text-none mr-2"
    variant="tonal"
    color="warning"
  >
    {{ t('msg.current-security-level', [t(`securityLevel.${effectiveToken?.decoded.level}`)]) }}
  </VBtn>
  <VMenu>
    <template v-slot:activator="{ props }">
      <VBtn
        v-bind="props"
        :loading="status === 'pending'"
        prepend-icon="i-mdi:account"
        class="text-none"
        variant="tonal"
        color="info"
      >
        {{ dense ? '' : data?.claims.username?.value }}
      </VBtn>
    </template>
    <VList>
      <VListItem v-for="(link, i) of links" :key="i" v-bind="link" :title="t(link.title)" />
    </VList>
  </VMenu>
</template>

<script setup lang="ts">
defineProps<{
  dense?: boolean
}>()

const { t } = useI18n()

const links = [
  { to: '/user/setting', title: 'pages.setting', prependIcon: 'i-mdi:account-cog-outline' },
  { to: '/auth/signout', title: 'pages.auth.signout', prependIcon: 'i-mdi:logout' }
]

const { data, status } = await useAsyncData(async () => {
  const resp = await api.session.claims.$get()
  return resp.json()
})

const { effectiveToken } = api
</script>

<i18n>
zhHans:
  securityLevel:
    0: 低
    1: 中
    2: 高
    3: 特权
</i18n>
