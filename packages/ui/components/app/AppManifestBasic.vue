<template>
  <VCard flat>
    <VCardText>
      <VTextField v-model="manifest.appId" label="App ID" />
      <VTextField v-model="manifest.name" label="Name" />
      <VTextarea v-model="manifest.description" label="Description" />
      <VTextField v-model="manifest.icon" label="Icon" />
      <CommonSecurityLevelInput v-model="manifest.securityLevel" />
      <template v-if="manifest.config">
        <VCheckbox v-model="manifest.config.autoInstall" label="Auto Install" />
        <VCheckbox v-model="manifest.config.promoted" label="Promoted" />
      </template>
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
manifest.value.config ??= {}
</script>
