<template>
  <VContainer>
    <VRow>
      <VCol cols="12">
        <VCard :title="t('msg.manage-session')">
          <VAlert type="info" :title="t('msg.tips')" :text="t('msg.not-implemented')" />
        </VCard>
      </VCol>
    </VRow>
  </VContainer>
</template>

<script setup lang="ts">
const { t } = useI18n()
</script>
