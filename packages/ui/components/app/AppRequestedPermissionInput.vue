<template>
  <VCard variant="outlined">
    <VCardText>
      <VTextField v-model="model.perm" label="Permission" />
      <VTextField v-model="model.reason" label="Reason" />
      <VCheckbox v-model="model.required" label="Required" />
    </VCardText>
  </VCard>
</template>

<script setup lang="ts">
import type { IAppRequestedPermission } from '@uaaa/server'

const model = defineModel<IAppRequestedPermission>({ required: true })
</script>
