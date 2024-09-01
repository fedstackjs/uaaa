<template>
  <VInput>
    <div>
      {{ t('msg.security-level') }}
      <VBtnToggle v-model="model" variant="outlined">
        <VBtn v-for="i in 5" :value="i - 1" :text="t(`securityLevel.${i - 1}`)" />
      </VBtnToggle>
    </div>
  </VInput>
</template>

<script setup lang="ts">
const model = defineModel<number>({ required: true })
const { t } = useI18n()
</script>
