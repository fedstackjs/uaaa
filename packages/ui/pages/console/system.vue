<template>
  <VRow>
    <VCol>
      <ConsoleSystemListCard />
    </VCol>
  </VRow>
</template>

<script setup lang="ts">
const { t } = useI18n()
useHead({
  title: 'System'
})
</script>
