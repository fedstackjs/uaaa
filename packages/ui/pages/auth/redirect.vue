<template>
  <VContainer class="fill-height justify-center">
    <VCard class="min-w-xs lg:min-w-md">
      <VCardTitle class="d-flex justify-center">
        <div>{{ t('pages.auth.redirect') }}</div>
      </VCardTitle>
      <VDivider />
      <VCardText>
        <VAlert type="info">
          {{ t('msg.redirecting') }}
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
  title: 'Redirect Callback'
})

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const authRedirect = useLocalStorage('authRedirect', '')

onMounted(() => {
  const value = authRedirect.value
  authRedirect.value = ''
  if (value) {
    if (value === 'false') return
    const { path, query, hash } = router.resolve(value)
    router.replace({
      path,
      query: { ...query, ...route.query },
      hash
    })
  } else if (!route.query.stub) {
    router.replace('/')
  }
})
</script>
