<template>
  <VBtn
    prepend-icon="mdi-security"
    class="text-none mr-2"
    variant="tonal"
    :color="color"
    :text="t('msg.current-security-level', [t(`securityLevel.${effectiveToken?.decoded.level}`)])"
  />

  <VMenu>
    <template v-slot:activator="{ props }">
      <VBtn
        v-bind="props"
        :loading="status === 'pending'"
        prepend-icon="mdi-account"
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
const router = useRouter()

const links = [
  { to: '/setting', title: 'pages.setting', prependIcon: 'mdi-account-cog-outline' },
  { to: '/auth/signout', title: 'pages.auth.signout', prependIcon: 'mdi-logout' }
]

const { data, status, refresh } = await useAsyncData(async () => {
  try {
    const claims = await api.getSessionClaims()
    return claims
  } catch (err) {
    if (isAPIError(err)) {
      switch (err.code) {
        case 'TOKEN_INVALID': {
          api.dropEffectiveToken()
        }
        case 'FORBIDDEN': {
          api.logout()
        }
      }
    }
  }
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

watch(
  () => effectiveToken.value,
  () => effectiveToken.value || router.replace('/auth/signin')
)
</script>
