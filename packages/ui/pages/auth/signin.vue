<template>
  <VContainer class="fill-height justify-center">
    <VCard class="min-w-md">
      <VCardTitle class="d-flex justify-center justify-between">
        <div class="flex-1 flex justify-start">
          <VBtn
            v-if="!isHome"
            icon="mdi-arrow-left"
            size="sm"
            variant="tonal"
            color="info"
            to="/auth/signin"
          />
        </div>
        <div>{{ $t('pages.signin') }}</div>
        <div class="flex-1 flex justify-start"></div>
      </VCardTitle>
      <VDivider />
      <NuxtPage />
    </VCard>
  </VContainer>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'plain'
})

const route = useRoute()
const isHome = computed(() => route.path.replace(/\/$/, '') === '/auth/signin')
</script>
