<template>
  <div class="flex justify-center">
    <div class="flex-1" />
    <VFileInput
      v-model="file"
      label="Import manifest file"
      prepend-icon="mdi-file-upload-outline"
      :loading="running"
    />
    <div class="flex-1" />
  </div>
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
  <CommonDictEditor
    v-model="manifest.environment"
    label="Environment"
    :factory="() => ({ value: '' })"
  >
    <template #item="scoped">
      <AppEnvInput v-bind="scoped" />
    </template>
  </CommonDictEditor>
  <VCheckbox v-model="manifest.promoted" label="Promoted" />
</template>

<script setup lang="ts">
import type { IAppManifest } from '@uaaa/server'
import { parseJSON5, parseJSONC, parseYAML, parseTOML } from 'confbox'

const manifest = defineModel<IAppManifest>({ required: true })

const file = ref<File | null>(null)

const newProvidedPermission = () => ({ name: '', description: '', path: '' })
const newRequestedClaim = () => ({ name: '', reason: '' })
const newRequestedPermission = () => ({ reason: '', perm: '' })

const { run, running } = useTask(async (file: File) => {
  const ext = file.name.split('.').pop()
  const content = await file.text()
  let value: IAppManifest
  switch (ext) {
    case 'json': {
      value = JSON.parse(content)
      break
    }
    case 'jsonc': {
      value = parseJSONC(content)
      break
    }
    case 'json5': {
      value = parseJSON5(content)
      break
    }
    case 'yaml':
    case 'yml': {
      value = parseYAML(content)
      break
    }
    case 'toml': {
      value = parseTOML(content)
      break
    }
    default: {
      throw new Error(`Unsupported file extension: ${ext}`)
    }
  }
  Object.assign(manifest.value, value)
})

watch(
  () => file.value,
  async (file) => file && run(file)
)
</script>
