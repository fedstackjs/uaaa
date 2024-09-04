<template>
  <VCard :title="t('pages.console.user')"></VCard>
</template>

<script setup lang="ts">
const { t } = useI18n()
useHead({
  title: 'User'
})
</script>
