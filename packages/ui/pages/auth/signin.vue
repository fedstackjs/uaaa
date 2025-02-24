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
          <div class="flex-1 flex justify-end">
            <VBtn
              v-if="showRemote"
              icon="mdi-qrcode"
              size="sm"
              variant="text"
              color="info"
              :disabled="remoteAuthorizeRunning"
              @click="startRemoteAuthorize"
            />
          </div>
        </div>
      </VCardTitle>
      <VDivider />
      <VAlert type="info" rounded="0" variant="tonal" class="whitespace-pre">
        {{ t('msg.login-hint') }}
      </VAlert>
      <VDivider />
      <VFadeTransition mode="out-in">
        <template v-if="isRemote">
          <VSkeletonLoader type="image" v-if="!userCode" />
          <div v-else class="flex">
            <div class="text-center p-4">
              <div>{{ t('msg.scan-qrcode-to-authorize') }}</div>
              <img :src="qrcode" />
            </div>
            <VDivider vertical />
            <div class="flex-1 self-stretch flex flex-col justify-center items-center p-4">
              <div>{{ t('msg.or-visit') }}</div>
              <div class="font-mono text-blue">{{ deviceUrl }}</div>
              <div>{{ t('msg.and-type-code-below') }}</div>
              <div class="text-2xl font-mono text-red">{{ userCode }}</div>
            </div>
            <VOverlay
              v-model="scanned"
              :close-on-back="false"
              class="justify-center items-center"
              contained
            >
              <div class="text-white text-center">
                <VProgressCircular :size="48" indeterminate color="white" />
                <div class="pt-4">{{ t('msg.scanned') }}</div>
              </div>
            </VOverlay>
          </div>
        </template>
        <template v-else-if="!type">
          <VCardText class="flex flex-col gap-2" v-if="data">
            <VBtn
              v-for="loginType of data"
              :key="loginType"
              variant="tonal"
              class="justify-start"
              :prepend-icon="credentialIcon(loginType)"
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
  const { types } = await resp.json()
  return types.filter((type) => t(`credentials.${type}`) !== `credentials.${type}`)
})

function postLogin() {
  router.replace(typeof route.query.redirect === 'string' ? route.query.redirect : '/')
}

const {
  showRemote,
  isRemote,
  userCode,
  qrcode,
  scanned,
  startRemoteAuthorize,
  remoteAuthorizeRunning
} = useRemoteAuthorize()

const deviceUrl = new URL('/remote', location.href)
</script>
