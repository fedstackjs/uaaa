<template>
  <VDialog activator="parent" class="max-w-lg">
    <template v-slot:default="{ isActive }">
      <VCard prepend-icon="mdi-note-edit" :title="t(`actions.${action}`)">
        <CredentialForm
          :type="type"
          :action="action"
          :credentialId="id"
          @updated="onUpdated(isActive)"
        />
      </VCard>
    </template>
  </VDialog>
</template>

<script setup lang="ts">
defineProps<{
  id?: string
  type: string
  action: 'bind' | 'unbind'
}>()
const emit = defineEmits<{
  updated: []
}>()

const { t } = useI18n()

function onUpdated(isActive: Ref<boolean>) {
  emit('updated')
  isActive.value = false
}
</script>

<i18n>
zh-Hans:
  remark: 备注  
</i18n>
