<template>
  <VCard variant="outlined">
    <VCardText>
      <VTextField v-model="model.name" label="Name" />
      <VTextField v-model="model.reason" label="Reason" />
      <VCheckbox v-model="model.required" label="Required" />
      <VCheckbox v-model="model.verified" label="verified" />
    </VCardText>
  </VCard>
</template>

<script setup lang="ts">
import type { IAppRequestedClaim } from '@uaaa/server'

const model = defineModel<IAppRequestedClaim>({ required: true })
</script>
