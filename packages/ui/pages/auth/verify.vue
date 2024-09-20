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
              <VBtn
                v-if="type"
                icon="mdi-arrow-left"
                size="sm"
                variant="tonal"
                color="info"
                @click="type = ''"
              />
            </VFadeTransition>
          </div>
          <div>{{ t('pages.auth.verify') }}</div>
          <div class="flex-1 flex justify-start"></div>
        </div>
      </VCardTitle>
      <VDivider />
      <VFadeTransition mode="out-in">
        <template v-if="!type">
          <VCardText class="flex flex-col gap-2" v-if="data?.types.length">
            <VBtn
              v-for="item of data.types"
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
        </template>
        <CredentialForm
          v-else
          action="verify"
          :type="type"
          :target-level="+targetLevel"
          @updated="onUpdated"
        />
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
  return resp.json()
})

function onUpdated() {
  router.replace(typeof route.query.redirect === 'string' ? route.query.redirect : '/')
}
</script>
