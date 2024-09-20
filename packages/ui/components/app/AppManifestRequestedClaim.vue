<template>
  <VCard flat>
    <VCardText>
      <CommonListEditor
        v-model="manifest.requestedClaims"
        label="Requested Claims"
        :factory="newRequestedClaim"
      >
        <template #item="scoped">
          <AppRequestedClaimInput v-bind="scoped" />
        </template>
      </CommonListEditor>
    </VCardText>
  </VCard>
</template>

<script setup lang="ts">
import type { IAppManifest } from '@uaaa/server'

const manifest = defineModel<IAppManifest>({ required: true })
const newRequestedClaim = () => ({ name: '', reason: '' })
</script>
