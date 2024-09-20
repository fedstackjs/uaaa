<template>
  <VCard flat>
    <VCardText>
      <VCheckbox v-model="manifest.promoted" label="Promoted" />
    </VCardText>
  </VCard>
</template>

<script setup lang="ts">
import type { IAppManifest } from '@uaaa/server'

const manifest = defineModel<IAppManifest>({ required: true })
</script>
