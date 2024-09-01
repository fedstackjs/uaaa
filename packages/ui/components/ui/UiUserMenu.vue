<template>
  <VMenu v-if="!dense">
    <template v-slot:activator="{ props }">
      <VBtn
        v-bind="props"
        prepend-icon="i-mdi:security"
        class="text-none mr-2"
        variant="tonal"
        :color="color"
        :text="
          t('msg.current-security-level', [t(`securityLevel.${effectiveToken?.decoded.level}`)])
        "
      />
    </template>
    <VList>
      <VListItem
        v-for="level of higherLevels"
        :key="level"
        :title="t('msg.upgrade-security-level-to', [t(`securityLevel.${level}`)])"
        :to="{ path: '/auth/verify', query: { redirect: route.fullPath, targetLevel: level } }"
      />
      <VListItem
        :title="t('msg.downgrade-security-level')"
        :to="{ path: '/auth/downgrade', query: { redirect: route.fullPath } }"
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
        {{ dense ? '' : data?.find(({ name }) => name === 'username')?.value }}
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
  new Array(4 - (effectiveToken.value?.decoded.level ?? 0))
    .fill(0)
    .map((_, i) => 4 - i)
    .reverse()
)

const { data, status, refresh } = await useAsyncData(async () => {
  return api.getUserClaims()
})

const { effectiveToken } = api
const color = computed(() => {
  switch (effectiveToken.value?.decoded.level) {
    case 4:
    case 3:
      return 'error'
    case 2:
    case 1:
      return 'warning'
    default:
      return 'info'
  }
})

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
    4: 安全设备
</i18n>
