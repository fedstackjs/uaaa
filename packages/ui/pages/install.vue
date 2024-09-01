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
    toast.error(t('msg.task-failed'))
  }
}

function cancel() {
  router.back()
}
</script>
