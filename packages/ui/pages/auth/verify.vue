<template>
  <VContainer class="flex flex-wrap items-center justify-center h-full lg:h-auto lg:pt-40!">
    <VCard class="min-w-xs lg:min-w-md">
      <VCardTitle class="d-flex flex-col items-center">
        <VIcon size="128">
          <CommonLogo variant="flat" />
        </VIcon>
        <div class="flex self-stretch">
          <div class="flex-1 flex justify-start">
            <VFadeTransition mode="out-in">
              <VBtn icon="mdi-arrow-left" size="sm" variant="tonal" color="info" @click="onBack" />
            </VFadeTransition>
          </div>
          <div>{{ t('pages.auth.verify') }}</div>
          <div class="flex-1 flex justify-start"></div>
        </div>
      </VCardTitle>
      <VDivider />
      <template v-if="data?.length">
        <VAlert type="info" rounded="0" variant="tonal" class="whitespace-pre">
          {{
            t('msg.verify-hint', {
              currentLevel: t(`securityLevel.${currentLevel}`),
              targetLevel: t(`securityLevel.${targetLevel}`)
            })
          }}
        </VAlert>
        <VDivider />
      </template>
      <VFadeTransition mode="out-in">
        <div v-if="!type">
          <VCardText class="flex flex-col gap-2" v-if="data?.length">
            <VBtn
              v-for="item of data"
              :key="item"
              variant="tonal"
              class="justify-start"
              :prepend-icon="credentialIcon(item)"
              :text="t('msg.verify-by', [t(`credentials.${item}`)])"
              @click="type = item"
            />
          </VCardText>
          <VAlert
            v-else
            type="info"
            variant="tonal"
            class="whitespace-pre"
            :title="t('msg.no-verify-methods')"
          >
            {{ t('msg.no-verify-methods-hint') }}
            <VSpacer />
            <VBtn
              :to="{ path: '/credential', query: { bind: targetLevel } }"
              variant="flat"
              color="info"
              :text="t('actions.goto', { target: t('pages.credential') })"
              prepend-icon="mdi-open-in-new"
            />
          </VAlert>
        </div>
        <div v-else>
          <CredentialForm
            action="verify"
            :type="type"
            :target-level="+targetLevel"
            @updated="onUpdated"
          />
        </div>
      </VFadeTransition>
    </VCard>
  </VContainer>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'authorize',
  middleware: 'verifyauth',
  level: 0
})

useHead({
  title: 'User Verify'
})

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const type = useRouteQuery<string>('verify_type', '')
const currentLevel = api.securityLevel
const targetLevel = useRouteQuery('targetLevel', '0')
const { config } = useTransparentUX()

const { data } = await useAsyncData(async () => {
  const resp = await api.session.upgrade.$get({ query: { targetLevel: targetLevel.value } })
  const { types } = await resp.json()
  return types.filter((type) => t(`credentials.${type}`) !== `credentials.${type}`)
})

watch(
  [data, config],
  ([data, config], [oldData, oldConfig]) => {
    if (config?.preferType === oldConfig?.preferType) return
    if (data?.includes(config?.preferType as any)) {
      type.value = config?.preferType as (typeof data)[number]
    }
  },
  { immediate: true }
)

let redirected = false

function onUpdated() {
  if (redirected) return
  redirected = true
  router.replace(typeof route.query.redirect === 'string' ? route.query.redirect : '/')
}

function onBack() {
  if (type.value) {
    type.value = ''
  } else {
    router.back()
  }
}

watch(
  () => api.effectiveToken.value?.decoded.level,
  (level) => {
    if ((level ?? 0) >= +targetLevel) {
      onUpdated()
    }
  }
)
</script>
