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
</template>

<script setup lang="ts">
import type { IAppManifest } from '@uaaa/server'
import { parseJSON5, parseJSONC, parseYAML, parseTOML } from 'confbox'

const manifest = defineModel<IAppManifest>({ required: true })

const file = ref<File | null>(null)

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
