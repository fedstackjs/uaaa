<template>
  <VAlert v-if="!app" type="error" :text="t('msg.app-not-found')" />
  <template v-else>
    <VList>
      <VListItem :title="app.name" :subtitle="app.description">
        <template #prepend>
          <AppAvatar :appId="app._id" :icon="app.icon" :name="app.name" />
        </template>
      </VListItem>
    </VList>
    <VCardText>
      <VAlert :text="t('msg.authorize-warn')" />
    </VCardText>
    <AppGrantEditor v-if="showGrant" :app="app" readonly />
    <VCardActions class="grid! grid-flow-col grid-auto-cols-[1fr]">
      <VBtn
        variant="tonal"
        color="info"
        :text="t(`msg.${showGrant ? 'hide' : 'show'}-grant`)"
        :disabled="running"
        @click="doShowGrant"
      />
      <VBtn
        variant="tonal"
        color="primary"
        :text="
          timerRunning
            ? t('msg.do-in-seconds', [rest, t('actions.authorize')])
            : t('actions.authorize')
        "
        :loading="running"
        @click="authorize"
      />
      <VBtn
        variant="tonal"
        color="error"
        :text="t('actions.cancel')"
        :disabled="running"
        @click="cancel"
      />
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
const showGrant = ref(false)

const { data: app } = await useAsyncData(async () => {
  const resp = await api.public.app[':id'].$get({ param: { id: props.connector.clientAppId } })
  const { app } = await resp.json()
  return app
})

const { run: authorize, running } = useTask(async () => {
  if (!app.value) return
  const { nonce, challenge } = await props.connector.checkAuthorize(app.value)
  const resp = await api.session.derive.$post({
    json: {
      clientAppId: props.connector.clientAppId,
      securityLevel: props.connector.securityLevel,
      nonce,
      challenge
    }
  })
  if (resp.ok) {
    const { tokenId } = await resp.json()
    await props.connector.onAuthorize(app.value, tokenId)
  } else {
    const err = await api.getError(resp)
    if (err.code === 'APP_NOT_INSTALLED') {
      toast.error(t('msg.app-not-installed'))
      router.replace({
        path: '/install',
        query: {
          appId: props.connector.clientAppId,
          redirect: route.fullPath
        }
      })
      return
    }
    throw err
  }
})

function cancel() {
  if (!app.value) return
  props.connector.onCancel(app.value)
}

function doShowGrant() {
  if (api.securityLevel.value < 1) {
    router.replace({
      path: '/auth/verify',
      query: { redirect: route.fullPath, targetLevel: 1 }
    })
  } else {
    showGrant.value = !showGrant.value
  }
}

const {
  start,
  rest,
  running: timerRunning
} = useTimer({
  onTimeout: () => authorize()
})

onMounted(async () => {
  const resp = await api.session.try_derive.$post({
    json: { clientAppId: props.connector.clientAppId, securityLevel: props.connector.securityLevel }
  })
  try {
    await api.checkResponse(resp)
  } catch (err) {
    if (isAPIError(err) && err.code === 'APP_NOT_INSTALLED') {
      toast.error(t('msg.app-not-installed'))
      router.replace({
        path: '/install',
        query: {
          appId: props.connector.clientAppId,
          redirect: route.fullPath
        }
      })
      return
    }
    // Handle error
    return
  }
  const { slientAuthorize } = await resp.json()
  if (slientAuthorize) {
    start(5)
  }
})
</script>
