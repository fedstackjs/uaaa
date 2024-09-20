<template>
  <VContainer>
    <VRow>
      <VCol cols="12">
        <SessionTokenListCard :session-id />
      </VCol>
    </VRow>
  </VContainer>
</template>

<script setup lang="ts">
const route = useRoute()
const sessionId = route.params.id as string
</script>
