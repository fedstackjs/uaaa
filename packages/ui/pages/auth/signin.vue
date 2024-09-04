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
          <div>{{ t('pages.auth.signin') }}</div>
          <div class="flex-1 flex justify-start"></div>
        </div>
      </VCardTitle>
      <VDivider />
      <VFadeTransition mode="out-in">
        <template v-if="!type">
          <VCardText class="flex flex-col gap-2" v-if="data">
            <VBtn
              v-for="loginType of data.types"
              :key="loginType"
              variant="tonal"
              class="justify-start"
              prepend-icon="mdi-lock"
              :text="t('msg.login-by', [t(`credentials.${loginType}`)])"
              @click="type = loginType"
            />
          </VCardText>
        </template>
        <CredentialForm v-else action="login" :type="type" @updated="postLogin" />
      </VFadeTransition>
    </VCard>
  </VContainer>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'plain',
  middleware: 'noauth'
})
useHead({
  title: 'Sign-In'
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
