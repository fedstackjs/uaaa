<template>
  <VCard :title="t('pages.console.index')"></VCard>
</template>

<script setup lang="ts">
const { t } = useI18n()
useHead({
  title: 'Home'
})
</script>
