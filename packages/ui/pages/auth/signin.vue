<template>
  <VContainer class="fill-height justify-center">
    <VCard class="min-w-md">
      <VCardTitle class="d-flex justify-center justify-between">
        <div class="flex-1 flex justify-start">
          <VBtn
            v-if="type"
            icon="i-mdi:arrow-left"
            size="sm"
            variant="tonal"
            color="info"
            @click="type = ''"
          />
        </div>
        <div>{{ t('pages.auth.signin') }}</div>
        <div class="flex-1 flex justify-start"></div>
      </VCardTitle>
      <VDivider />
      <template v-if="!type">
        <VCardText class="flex flex-col gap-2" v-if="data">
          <VBtn
            v-for="loginType of data.types"
            :key="loginType"
            variant="tonal"
            class="justify-start"
            prepend-icon="i-mdi:lock"
            :text="t('msg.login-by', [t(`credentials.${loginType}`)])"
            @click="type = loginType"
          />
        </VCardText>
      </template>
      <CredentialForm v-else action="login" :type="type" @updated="postLogin" />
    </VCard>
  </VContainer>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'plain',
  middleware: 'noauth'
})

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const type = useRouteQuery<string>('type', '')

const { data } = await useAsyncData(async () => {
  const resp = await api.public.login.$get()
  return resp.json()
})

function postLogin() {
  router.replace(typeof route.query.redirect === 'string' ? route.query.redirect : '/')
}
</script>
