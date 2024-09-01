<template>
  <VMenu v-if="!dense">
    <template v-slot:activator="{ props }">
      <VBtn
        v-bind="props"
        prepend-icon="i-mdi:security"
        class="text-none mr-2"
        variant="tonal"
        color="warning"
      >
        {{ t('msg.current-security-level', [t(`securityLevel.${effectiveToken?.decoded.level}`)]) }}
      </VBtn>
    </template>
    <VList>
      <VListItem
        v-for="level of higherLevels"
        :key="level"
        :title="t('msg.upgrade-security-level-to', [t(`securityLevel.${level}`)])"
        :to="{ path: '/auth/verify', query: { redirect: route.fullPath, targetLevel: level } }"
      />
    </VList>
  </VMenu>

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
const route = useRoute()

const links = [
  { to: '/setting', title: 'pages.setting', prependIcon: 'i-mdi:account-cog-outline' },
  { to: '/auth/signout', title: 'pages.auth.signout', prependIcon: 'i-mdi:logout' }
]

const higherLevels = computed(() =>
  new Array(3 - (effectiveToken.value?.decoded.level ?? 0))
    .fill(0)
    .map((_, i) => 3 - i)
    .reverse()
)

const { data, status, refresh } = await useAsyncData(async () => {
  const resp = await api.session.claims.$get()
  return resp.json()
})

const { effectiveToken } = api

watch(
  () => effectiveToken.value?.decoded.level,
  () => refresh()
)
</script>

<i18n>
zhHans:
  securityLevel:
    0: 低
    1: 中
    2: 高
    3: 特权
</i18n>
