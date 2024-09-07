<template>
  <VDialog max-width="340" v-model="model">
    <template v-slot:default="{ isActive }">
      <VCard prepend-icon="mdi-note-edit" :title="t(`actions.edit`, [t(`claims.${name}`)])">
        <VCardText>
          <VTextarea v-model="value" :label="t(`claims.${name}`)" />
        </VCardText>
        <VCardActions>
          <VBtn :text="t('actions.cancel')" color="secondary" @click="model = false" />
          <VBtn :text="t('actions.reset')" color="error" @click="value = props.value" />
          <VBtn :text="t('actions.submit')" color="primary" @click="run()" />
        </VCardActions>
      </VCard>
    </template>
  </VDialog>
</template>

<script setup lang="ts">
const props = defineProps<{
  name: string
  value: string
}>()

const model = defineModel<boolean>()
const emit = defineEmits<{
  updated: []
}>()
const { t } = useI18n()
const value = ref('')

watch(
  () => props.value,
  () => {
    value.value = props.value
  },
  { immediate: true }
)

const { run } = useTask(async () => {
  const resp = await api.user.claim[':name'].$patch({
    param: { name: props.name },
    json: { value: value.value }
  })
  await api.checkResponse(resp)
  model.value = false
  emit('updated')
})
</script>
