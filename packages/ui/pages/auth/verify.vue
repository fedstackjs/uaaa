<template>
  <VContainer class="fill-height justify-center">
    <VCard class="min-w-md">
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
      <VFadeTransition mode="out-in">
        <div v-if="!type">
          <VCardText class="flex flex-col gap-2" v-if="data?.length">
            <VBtn
              v-for="item of data"
              :key="item"
              variant="tonal"
              class="justify-start"
              prepend-icon="mdi-lock"
              :text="t('msg.verify-by', [t(`credentials.${item}`)])"
              @click="type = item"
            />
          </VCardText>
          <VAlert v-else type="info" :title="t('msg.tips')">
            <div>{{ t('msg.no-verify-methods') }}</div>
            <VBtn
              @click="router.back()"
              variant="flat"
              color="white"
              prepend-icon="mdi-arrow-left"
              :text="t('actions.back')"
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
  layout: 'plain',
  middleware: 'verifyauth'
})
useHead({
  title: 'User Verify'
})

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const type = useRouteQuery<string>('type', '')
const targetLevel = useRouteQuery('targetLevel', '0')

const { data } = await useAsyncData(async () => {
  const resp = await api.session.elevate.$get({ query: { targetLevel: targetLevel.value } })
  const { types } = await resp.json()
  return types.filter((type) => t(`credentials.${type}`) !== `credentials.${type}`)
})

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
