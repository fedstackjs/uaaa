<template>
  <VCard variant="outlined">
    <VCardText>
      <VTextField v-model="model.name" label="Name" />
      <VTextarea v-model="model.description" label="Description" />
      <VTextField v-model="model.path" label="Path" />
    </VCardText>
  </VCard>
</template>

<script setup lang="ts">
import type { IAppProvidedPermission } from '@uaaa/server'

const model = defineModel<IAppProvidedPermission>({ required: true })
</script>
