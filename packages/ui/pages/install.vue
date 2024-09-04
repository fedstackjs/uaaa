<template>
  <VContainer>
    <VRow>
      <VCol cols="12">
        <VCard v-if="app" :title="t('msg.install-app')">
          <VList>
            <VListItem :title="app.name" :subtitle="app.description" />
          </VList>
          <VDivider />
          <VCardTitle class="text-center">{{ t('msg.grants') }}</VCardTitle>
          <div class="flex">
            <div class="flex-1">
              <VCardSubtitle>{{ t('msg.permissions') }}</VCardSubtitle>
              <div class="px-4">
                <VCheckbox
                  v-for="(permission, i) of app.requestedPermissions"
                  :key="'p' + i"
                  v-model="permissions[permission.perm]"
                  :label="permission.perm"
                  :messages="t('msg.request-for', [permission.reason])"
                  :disabled="permission.required"
                />
              </div>
            </div>
            <VDivider vertical />
            <div class="flex-1">
              <VCardSubtitle>{{ t('msg.claims') }}</VCardSubtitle>
              <div class="px-4">
                <VCheckbox
                  v-for="(claim, i) of app.requestedClaims"
                  density="compact"
                  :key="'c' + i"
                  v-model="claims[claim.name]"
                  :label="t(`claims.${claim.name}`, [], { default: claim.name })"
                  :messages="t('msg.request-for', [claim.reason])"
                  :disabled="claim.required"
                  :append-icon="claim.verified ? 'mdi-shield-check' : undefined"
                />
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
        toast.error(t('missing-required-claims', [err.data.claims.join(', ')]))
        break
      case 'MISSING_VERIFIED_CLAIMS':
        toast.error(t('missing-verified-claims', [err.data.claims.join(', ')]))
        break
      case 'MISSING_REQUIRED_PERMISSIONS':
        toast.error(t('missing-required-permissions', [err.data.perms.join(', ')]))
        break
      default:
        toast.error(t('task-failed-with', [err.code]))
    }
  }
}

function cancel() {
  router.back()
}
</script>

<i18n>
zhHans:
  missing-required-claims: '缺少必要的信息：{0}'
  missing-verified-claims: '缺少已验证的信息：{0}'
  missing-required-permissions: '缺少必要的权限：{0}'
  task-failed-with: '任务失败：{0}'
</i18n>
