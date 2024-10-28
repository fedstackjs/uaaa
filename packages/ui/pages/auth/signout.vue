<template>
  <VContainer class="fill-height justify-center">
    <VCard class="min-w-xs lg:min-w-md">
      <VCardTitle class="d-flex flex-col items-center">
        <VIcon size="128">
          <CommonLogo variant="flat" />
        </VIcon>
        <div class="flex self-stretch">
          <div class="flex-1 flex justify-start"></div>
          <div>{{ t('pages.auth.signout') }}</div>
          <div class="flex-1 flex justify-start"></div>
        </div>
      </VCardTitle>
      <VDivider />
      <VCardText>
        <VAlert type="success" icon="mdi-check-circle-outline">
          {{ t('scoped.msg') }}
        </VAlert>
      </VCardText>
    </VCard>
  </VContainer>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'plain'
})
useHead({
  title: 'Sign-Out'
})

const router = useRouter()
const { t } = useI18n()

onMounted(() => {
  setTimeout(async () => {
    await api.logout()
    router.replace('/')
  }, 1000)
})
</script>

<i18n>
en:
  scoped:
    msg: You have successfully signed out, redirecting to home page
zh-Hans:
  scoped:
    msg: 您已成功登出，即将跳转到首页
</i18n>
