<template>
  <VTextField v-model="manifest.appId" label="App ID" />
  <VTextField v-model="manifest.name" label="Name" />
  <VTextarea v-model="manifest.description" label="Description" />
  <CommonSecurityLevelInput v-model="manifest.securityLevel" />
  <CommonListEditor
    v-model="manifest.providedPermissions"
    label="Provided Permissions"
    :factory="newProvidedPermission"
  >
    <template #item="scoped">
      <AppProvidedPermissionInput v-bind="scoped" />
    </template>
  </CommonListEditor>
  <CommonListEditor
    v-model="manifest.requestedClaims"
    label="Requested Claims"
    :factory="newRequestedClaim"
  >
    <template #item="scoped">
      <AppRequestedClaimInput v-bind="scoped" />
    </template>
  </CommonListEditor>
  <CommonListEditor
    v-model="manifest.requestedPermissions"
    label="Requested Permissions"
    :factory="newRequestedPermission"
  >
    <template #item="scoped">
      <AppRequestedPermissionInput v-bind="scoped" />
    </template>
  </CommonListEditor>
  <CommonListEditor v-model="manifest.callbackUrls" label="Callback URLs" :factory="() => ''">
    <template #item="scoped">
      <VTextField v-bind="scoped" label="Callback URL" />
    </template>
  </CommonListEditor>
  <VCheckbox v-model="manifest.promoted" label="Promoted" />
</template>

<script setup lang="ts">
import type { IAppManifest } from '@uaaa/server'

const manifest = defineModel<IAppManifest>({ required: true })

const newProvidedPermission = () => ({ name: '', description: '', path: '' })
const newRequestedClaim = () => ({ name: '', reason: '' })
const newRequestedPermission = () => ({ reason: '', perm: '' })
</script>
