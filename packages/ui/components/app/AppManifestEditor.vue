<template>
  <div class="d-flex flex-row">
    <VTabs v-model="tab" direction="vertical">
      <VTab :value="0" text="Manifest File" />
      <VTab :value="1" text="Basic Info" />
      <VTab :value="2" text="Provided Permissions" />
      <VTab :value="3" text="Requested Permissions" />
      <VTab :value="4" text="Requested Claims" />
      <VTab :value="5" text="Variables" />
      <VTab :value="6" text="Secrets" />
      <VTab :value="7" text="Misc" />
    </VTabs>
    <VDivider vertical />
    <VTabsWindow v-model="tab" class="flex-1">
      <VTabsWindowItem :value="0">
        <AppManifestFile v-model="manifest" />
      </VTabsWindowItem>
      <VTabsWindowItem :value="1">
        <AppManifestBasic v-model="manifest" />
      </VTabsWindowItem>
      <VTabsWindowItem :value="2">
        <AppManifestProvidedPerm v-model="manifest" />
      </VTabsWindowItem>
      <VTabsWindowItem :value="3">
        <AppManifestRequestedPerm v-model="manifest" />
      </VTabsWindowItem>
      <VTabsWindowItem :value="4">
        <AppManifestRequestedClaim v-model="manifest" />
      </VTabsWindowItem>
      <VTabsWindowItem :value="5">
        <AppManifestVariable v-model="manifest" />
      </VTabsWindowItem>
      <VTabsWindowItem :value="6">
        <AppManifestSecret v-model="manifest" />
      </VTabsWindowItem>
      <VTabsWindowItem :value="7">
        <AppManifestMisc v-model="manifest" />
      </VTabsWindowItem>
    </VTabsWindow>
  </div>
</template>

<script setup lang="ts">
import type { IAppManifest } from '@uaaa/server'
import { parseJSON5, parseJSONC, parseYAML, parseTOML } from 'confbox'

const manifest = defineModel<IAppManifest>({ required: true })

const file = ref<File | null>(null)
const tab = ref(0)

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
