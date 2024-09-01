<template>
  <VContainer class="fill-height justify-center">
    <VCard class="min-w-md">
      <VCardTitle class="d-flex justify-center justify-between">
        <div class="flex-1 flex justify-start">
          <VBtn
            v-if="!isHome"
            icon="i-mdi:arrow-left"
            size="sm"
            variant="tonal"
            color="info"
            :to="{ path: `/auth/verify`, query: route.query }"
          />
        </div>
        <div>{{ t('pages.auth.verify') }}</div>
        <div class="flex-1 flex justify-start"></div>
      </VCardTitle>
      <VDivider />
      <NuxtPage />
    </VCard>
  </VContainer>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'plain',
  middleware: 'verifyauth'
})

const { t } = useLocale()
const route = useRoute()
const isHome = computed(() => route.path.replace(/\/$/, '') === '/auth/verify')
</script>
