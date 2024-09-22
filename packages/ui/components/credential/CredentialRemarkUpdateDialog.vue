<template>
  <VDialog activator="parent" max-width="340">
    <template v-slot:default="{ isActive }">
      <VCard prepend-icon="mdi-note-edit" :title="t('actions.edit-remark')">
        <VCardText>
          <VTextarea v-model="value" :label="t('remark')" clearable @click:clear="value = remark" />
        </VCardText>
        <VCardActions>
          <VBtn class="ml-auto" :text="t('actions.cancel')" @click="isActive.value = false" />
          <VBtn
            :text="t('actions.save')"
            @click="
              run().then(() => {
                isActive.value = false
              })
            "
          />
        </VCardActions>
      </VCard>
    </template>
  </VDialog>
</template>

<script setup lang="ts">
const props = defineProps<{
  id: string
  remark: string
}>()
const emit = defineEmits<{
  updated: []
}>()

const value = ref(props.remark)

const { t } = useI18n()
const { run } = useTask(async () => {
  const resp = await api.user.credential[':id'].$patch({
    param: { id: props.id },
    json: { remark: value.value }
  })
  if (resp.ok) {
    emit('updated')
  }
})
</script>

<i18n>
zh-Hans:
  remark: 备注  
</i18n>
