<template>
  <VRow>
    <VCol>
      <ConsoleAppListCard />
    </VCol>
  </VRow>
</template>

<script setup lang="ts">
const { t } = useI18n()
useHead({
  title: 'App'
})
</script>
