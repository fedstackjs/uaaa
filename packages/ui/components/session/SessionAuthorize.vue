<template>
  <VAlert v-if="!app" type="error" :text="t('msg.app-not-found')" />
  <template v-else>
    <VList>
      <VListItem :title="app.name" :subtitle="app.description" />
    </VList>
    <VCardText>
      <VAlert :text="t('msg.authorize-warn')" />
    </VCardText>
    <VCardActions class="flex justify-center">
      <VBtn variant="tonal" color="primary" :text="t('actions.authorize')" @click="authorize" />
      <VBtn variant="tonal" color="error" :text="t('actions.cancel')" @click="cancel" />
    </VCardActions>
  </template>
</template>

<script setup lang="ts">
import type { Connector } from '~/utils/connector'

const props = defineProps<{
  connector: Connector
}>()
const { t } = useI18n()

const toast = useToast()
const route = useRoute()
const router = useRouter()

const { data: app } = await useAsyncData(async () => {
  const resp = await api.public.app[':id'].$get({ param: { id: props.connector.clientAppId } })
  const { app } = await resp.json()
  return app
})

async function authorize() {
  if (!app.value) return
  try {
    await props.connector.checkAuthorize(app.value)
    const resp = await api.session.derive.$post({
      json: {
        clientAppId: props.connector.clientAppId,
        securityLevel: props.connector.securityLevel
      }
    })
    if (resp.ok) {
      const { tokenId } = await resp.json()
      await props.connector.onAuthorize(app.value, tokenId)
    } else {
      const { code } = await api.getError(resp)
      if (code === 'APP_NOT_INSTALLED') {
        toast.error(t('msg.app-not-installed'))
        router.replace({
          path: '/install',
          query: {
            appId: props.connector.clientAppId,
            redirect: route.fullPath
          }
        })
      }
    }
  } catch {
    toast.error(t('msg.task-failed'))
  }
}

function cancel() {
  if (!app.value) return
  props.connector.onCancel(app.value)
}
</script>
