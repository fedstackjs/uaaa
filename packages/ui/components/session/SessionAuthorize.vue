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
      <VAlert
        v-if="params.userCode"
        type="warning"
        :text="t('msg.remote-warn', { code: params.userCode })"
        class="whitespace-pre"
      />
      <VAlert v-else :text="t('msg.authorize-warn')" />
    </VCardText>
    <AppGrantEditor v-if="showGrant" :app="app" readonly />
    <SessionGrantViewer v-else :permissions="grantedPermissions" />
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
import type { IAuthorizeParams } from '~/composables/useAuthorize'

const props = defineProps<{
  params: IAuthorizeParams
}>()
const { t } = useI18n()

const toast = useToast()
const route = useRoute()
const router = useRouter()
const showGrant = ref(false)
const grantedPermissions = ref<string[]>([])

const { data: app } = await useAsyncData(async () => {
  const resp = await api.public.app[':id'].$get({ param: { id: props.params.clientAppId } })
  const { app } = await resp.json()
  return app
})

const { run: authorize, running } = useTask(async () => {
  if (!app.value) return
  await props.params.connector.preAuthorize(props.params, app.value)
  try {
    await props.params.connector.onAuthorize(props.params, app.value)
    router.replace('/')
  } catch (err) {
    if (isAPIError(err) && err.code === 'APP_NOT_INSTALLED') {
      toast.error(t('msg.app-not-installed'))
      router.replace({
        path: '/install',
        query: {
          appId: props.params.clientAppId,
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
  props.params.connector.onCancel(props.params, app.value)
}

function doShowGrant() {
  if (api.securityLevel.value < 1) {
    router.replace({
      path: '/auth/verify',
      query: { redirect: route.fullPath, targetLevel: 1 }
    })
  } else {
    showGrant.value = !showGrant.value
    reset()
  }
}

const {
  start,
  reset,
  rest,
  running: timerRunning
} = useTimer({
  onTimeout: () => authorize()
})

onMounted(async () => {
  const resp = await api.session.try_derive.$post({
    json: {
      clientAppId: props.params.clientAppId,
      securityLevel: props.params.securityLevel,
      permissions: props.params.permissions,
      optionalPermissions: props.params.optionalPermissions,
      confidential: props.params.confidential,
      remote: !!props.params.userCode
    }
  })
  try {
    await api.checkResponse(resp)
  } catch (err) {
    if (isAPIError(err) && err.code === 'APP_NOT_INSTALLED') {
      toast.error(t('msg.app-not-installed'))
      router.replace({
        path: '/install',
        query: {
          appId: props.params.clientAppId,
          redirect: route.fullPath
        }
      })
      return
    }
    // Handle error
    return
  }
  const { permissions } = await resp.json()
  grantedPermissions.value = permissions
  const parsedPermissions = permissions
    .map((perm) => Permission.fromCompactString(perm))
    .filter((perm) => perm.appId === 'uaaa')
  if (parsedPermissions.some((perm) => perm.test('/session/slient_authorize'))) {
    start(5)
  }
})
</script>
