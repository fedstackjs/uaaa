<template>
  <VContainer>
    <VRow>
      <VCol cols="12">
        <ClaimInfoCard />
      </VCol>
    </VRow>
  </VContainer>
</template>

<script setup lang="ts">
definePageMeta({
  level: 2
})

useHead({
  title: 'User Settings'
})
</script>
