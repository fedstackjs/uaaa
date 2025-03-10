<template>
  <VContainer>
    <VRow>
      <VCol cols="12">
        <VCard v-if="app" :title="t('msg.install-app')">
          <VList>
            <VListItem :title="app.name" :subtitle="app.description">
              <template #prepend>
                <AppAvatar :appId="app._id" :icon="app.icon" :name="app.name" />
              </template>
            </VListItem>
          </VList>
          <template v-if="app.variables['ui:install_description']">
            <VAlert
              type="info"
              color=""
              :rounded="0"
              :text="app.variables['ui:install_description']"
            />
          </template>
          <VDivider />
          <VCardTitle class="text-center">{{ t('msg.grants') }}</VCardTitle>
          <VDivider />
          <AppGrantEditor
            v-model:claims="claims"
            v-model:permissions="permissions"
            :app="app"
            fill-required
          />
          <VDivider />
          <VCardActions class="flex justify-center">
            <VBtn variant="tonal" color="primary" :text="t('actions.install')" @click="install" />
            <VBtn variant="tonal" color="error" :text="t('actions.cancel')" @click="cancel" />
          </VCardActions>
        </VCard>
      </VCol>
    </VRow>
  </VContainer>
</template>

<script setup lang="ts">
definePageMeta({
  level: 2
})

useHead({
  title: 'Install App'
})

const { t } = useI18n()

const appId = useRouteQuery<string>('appId', '')
const router = useRouter()
const route = useRoute()
const toast = useToast()
const permissions = ref<Record<string, boolean>>({})
const claims = ref<Record<string, boolean>>({})

const { data: app } = await useAsyncData(async () => {
  const resp = await api.public.app[':id'].$get({ param: { id: appId.value } })
  const { app } = await resp.json()
  return app
})

async function install() {
  const resp = await api.user.installation.$put({
    json: {
      appId: appId.value,
      grantedClaims: Object.entries(claims.value)
        .filter(([, v]) => v)
        .map(([k]) => k),
      grantedPermissions: Object.entries(permissions.value)
        .filter(([, v]) => v)
        .map(([k]) => k)
    }
  })
  if (resp.ok) {
    toast.success(t('msg.task-succeeded'))
    router.replace(typeof route.query.redirect === 'string' ? route.query.redirect : '/')
  } else {
    const err = await api.getError(resp)
    switch (err.code) {
      case 'MISSING_REQUIRED_CLAIMS':
        toast.error(t('msg.missing-required-claims', [err.data.claims.join(', ')]))
        break
      case 'MISSING_VERIFIED_CLAIMS':
        toast.error(t('msg.missing-verified-claims', [err.data.claims.join(', ')]))
        break
      case 'MISSING_REQUIRED_PERMISSIONS':
        toast.error(t('msg.missing-required-permissions', [err.data.perms.join(', ')]))
        break
      default:
        toast.error(t('msg.task-failed-with', [err.code]))
    }
  }
}

function cancel() {
  router.back()
}
</script>
