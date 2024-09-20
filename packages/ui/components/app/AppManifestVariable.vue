<template>
  <VCard flat>
    <VCardText>
      <CommonDictEditor v-model="manifest.variables" label="Variables" :factory="() => ''">
        <template #item="scoped">
          <VTextField v-bind="scoped" label="Value" />
        </template>
      </CommonDictEditor>
    </VCardText>
  </VCard>
</template>

<script setup lang="ts">
import type { IAppManifest } from '@uaaa/server'

const manifest = defineModel<IAppManifest>({ required: true })
</script>
