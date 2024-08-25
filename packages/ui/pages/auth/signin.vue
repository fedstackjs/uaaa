<template>
  <VContainer class="fill-height justify-center">
    <VCard :title="$t('pages.signin')" class="min-w-md">
      <VDivider />
      <VCardText class="flex flex-col gap-2">
        <VBtn variant="tonal" class="justify-start" prepend-icon="mdi-lock" text="password" />
        <VBtn variant="tonal" class="justify-start" prepend-icon="mdi-key" text="passkey" />
        <VBtn variant="tonal" class="justify-start" prepend-icon="mdi-phone" text="phone" />
        <VBtn variant="tonal" class="justify-start" prepend-icon="mdi-email" text="email" />
      </VCardText>
    </VCard>
  </VContainer>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'plain'
})
</script>
