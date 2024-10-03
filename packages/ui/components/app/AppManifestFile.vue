<template>
  <div class="flex flex-col items-stretch">
    <div class="flex">
      <VFileInput
        v-model="file"
        label="Import manifest file"
        prepend-icon="mdi-file-upload-outline"
        :loading="running"
      />
    </div>
    <div class="flex">
      <VRadioGroup v-model="format" inline label="Export format">
        <VRadio value="json" label="JSON" />
        <VRadio value="jsonc" label="JSONC" />
        <VRadio value="json5" label="JSON5" />
        <VRadio value="yaml" label="YAML" />
        <VRadio value="toml" label="TOML" />
      </VRadioGroup>
    </div>
    <div class="flex">
      <VBtn
        text="Export manifest file"
        prepend-icon="mdi-file-download-outline"
        @click="exportFile"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { IAppManifest } from '@uaaa/server'
import * as confbox from 'confbox'

const manifest = defineModel<IAppManifest>({ required: true })

const file = ref<File | null>(null)

const { run, running } = useTask(async (file: File) => {
  const ext = file.name.split('.').pop()
  const content = await file.text()
  let value: IAppManifest
  switch (ext) {
    case 'json': {
      value = confbox.parseJSON(content)
      break
    }
    case 'jsonc': {
      value = confbox.parseJSONC(content)
      break
    }
    case 'json5': {
      value = confbox.parseJSON5(content)
      break
    }
    case 'yaml':
    case 'yml': {
      value = confbox.parseYAML(content)
      break
    }
    case 'toml': {
      value = confbox.parseTOML(content)
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

const format = ref('json')

function exportFile() {
  let value = ''
  switch (format.value) {
    case 'json': {
      value = JSON.stringify(manifest.value, null, 2)
      break
    }
    case 'jsonc': {
      value = confbox.stringifyJSONC(manifest.value)
      break
    }
    case 'json5': {
      value = confbox.stringifyJSON5(manifest.value)
      break
    }
    case 'yaml': {
      value = confbox.stringifyYAML(manifest.value)
      break
    }
    case 'toml': {
      value = confbox.stringifyTOML(manifest.value)
      break
    }
  }
  const file = new File([value], 'manifest.' + format.value, { type: 'text/plain' })
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  URL.revokeObjectURL(url)
}
</script>
