<template>
  <VDialog activator="parent" max-width="340">
    <template v-slot:default="{ isActive }">
      <VCard prepend-icon="i-mdi:note-edit" :title="t(`actions.${action}`)">
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
zhHans:
  remark: 备注  
</i18n>
