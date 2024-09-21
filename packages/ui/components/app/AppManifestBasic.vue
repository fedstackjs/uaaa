<template>
  <VCard flat>
    <VCardText>
      <VTextField v-model="manifest.appId" label="App ID" />
      <VTextField v-model="manifest.name" label="Name" />
      <VTextarea v-model="manifest.description" label="Description" />
      <VTextField v-model="manifest.icon" label="Icon" />
      <CommonSecurityLevelInput v-model="manifest.securityLevel" />
      <CommonListEditor v-model="manifest.callbackUrls" label="Callback URLs" :factory="() => ''">
        <template #item="scoped">
          <VTextField v-bind="scoped" label="Callback URL" />
        </template>
      </CommonListEditor>
    </VCardText>
  </VCard>
</template>

<script setup lang="ts">
import type { IAppManifest } from '@uaaa/server'

const manifest = defineModel<IAppManifest>({ required: true })
</script>
