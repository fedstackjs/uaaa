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
          <VDivider />
          <VCardTitle class="text-center">{{ t('msg.grants') }}</VCardTitle>
          <VDivider />
          <div class="flex">
            <div class="flex-1">
              <VCardSubtitle class="text-center">{{ t('msg.permissions') }}</VCardSubtitle>
              <div class="px-4">
                <div v-for="(permission, i) of app.requestedPermissions" :key="'p' + i">
                  <VCheckbox
                    v-model="permissions[permission.perm]"
                    :label="permission.perm"
                    :readonly="permission.required"
                    hide-details
                    color="primary"
                    class="font-mono"
                  />
                  <div class="px-4">
                    <b
                      v-if="permission.required"
                      class="text-red pr-1"
                      v-text="t('msg.required')"
                    />
                    <span class="pr-1" v-text="t('msg.will-grant-permission-for')" />
                    <b v-text="permission.reason" />
                  </div>
                  <AppPermissionList :permission="permission.perm" />
                </div>
              </div>
            </div>
            <VDivider vertical />
            <div class="flex-1">
              <VCardSubtitle class="text-center">{{ t('msg.claims') }}</VCardSubtitle>
              <div class="px-4">
                <div v-for="(claim, i) of app.requestedClaims" :key="'c' + i">
                  <VCheckbox
                    density="compact"
                    v-model="claims[claim.name]"
                    :append-icon="claim.verified ? 'mdi-shield-check' : undefined"
                    :readonly="claim.required"
                    hide-details
                    color="primary"
                    class="font-mono"
                  >
                    <template #label>
                      <b v-text="t(`claims.${claim.name}`, [], { default: claim.name })" />
                    </template>
                  </VCheckbox>
                  <div class="m-t-[-12px] text-sm">
                    <b v-if="claim.required" class="text-red pr-1" v-text="t('msg.required')" />
                    <span class="pr-1" v-text="t('msg.will-grant-claim-for')" />
                    <b v-text="claim.reason" />
                  </div>
                </div>
              </div>
            </div>
          </div>
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
  level: 1
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
  try {
    const resp = await api.user.installation[':id'].$get({ param: { id: appId.value } })
    if (resp.ok) {
      const { installation } = await resp.json()
      console.log(installation)
      permissions.value = Object.fromEntries(installation.grantedPermissions.map((p) => [p, true]))
      claims.value = Object.fromEntries(installation.grantedClaims.map((c) => [c, true]))
    }
  } catch {
    permissions.value = {}
    claims.value = {}
  }
  for (const permission of app.requestedPermissions) {
    if (permission.required) {
      permissions.value[permission.perm] = true
    }
  }
  for (const claim of app.requestedClaims) {
    if (claim.required) {
      claims.value[claim.name] = true
    }
  }
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
