<template>
  <VDialog max-width="1280" v-model="model">
    <template v-slot:default="{ isActive }">
      <VCard prepend-icon="mdi-note-edit" :title="t(`actions.edit`, [t(`msg.app`)])">
        <AppManifestEditor v-model="value" />
        <VCardActions>
          <VBtn :text="t('actions.cancel')" color="secondary" @click="model = false" />
          <VBtn
            :text="t('actions.reset')"
            color="error"
            @click="value = JSON.parse(JSON.stringify(props.manifest))"
          />
          <VBtn :text="t('actions.submit')" color="primary" @click="run()" />
        </VCardActions>
      </VCard>
    </template>
  </VDialog>
</template>

<script setup lang="ts">
import type { IAppManifest } from '@uaaa/server'

const props = defineProps<{
  manifest: IAppManifest
}>()

const model = defineModel<boolean>()
const emit = defineEmits<{
  updated: []
}>()
const { t } = useI18n()
const value = ref<IAppManifest>(JSON.parse(JSON.stringify(props.manifest)))

watch(
  () => props.manifest,
  () => {
    value.value = JSON.parse(JSON.stringify(props.manifest))
  },
  { immediate: true, deep: true }
)

const { run } = useTask(async () => {
  await api.console.app[':id'].$patch({
    param: { id: value.value.appId },
    json: value.value
  })
  model.value = false
  emit('updated')
})
</script>
