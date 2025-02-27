<template>
  <VBtn prepend-icon="mdi-security" class="text-none mr-2" variant="tonal" :color="color">
    {{
      dense
        ? t(`securityLevel.${effectiveToken?.decoded.level}`)
        : t('msg.current-security-level', [t(`securityLevel.${effectiveToken?.decoded.level}`)])
    }}
  </VBtn>

  <VMenu>
    <template v-slot:activator="{ props }">
      <VBtn
        v-bind="props"
        :loading="!username"
        prepend-icon="mdi-account"
        class="text-none"
        variant="tonal"
        color="info"
      >
        <template v-if="dense">
          {{ t('msg.user-menu') }}
        </template>
        <template v-else>
          {{ username }}
        </template>
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

const { effectiveToken, claims } = api
const username = computed(() => claims.value?.username?.value)
const color = computed(() => {
  switch (effectiveToken.value?.decoded.level) {
    case 4:
    case 3:
      return 'error'
    case 2:
      return 'warning'
    case 1:
    default:
      return 'info'
  }
})

watch(
  () => effectiveToken.value,
  () => effectiveToken.value || router.replace('/auth/signin')
)
</script>
