<template>
  <VListItem :subtitle="t(`msg.credential-type`, [t(`credentials.${credential.type}`)])">
    <template #prepend>
      <VAvatar>
        <VIcon icon="mdi-key" />
      </VAvatar>
    </template>
    <template #title>
      <div class="flex gap-2 text-sm">
        <span>
          <b class="pr-1">{{ t('msg.credential-id') }}</b>
          <code class="text-bluegray-600">{{ credential._id }}</code>
        </span>
        <span v-if="credential.userIdentifier">
          <b class="pr-1">{{ t('msg.credential-user-identifier') }}</b>
          <code class="text-bluegray-600">{{ credential.userIdentifier }}</code>
        </span>
        <span v-else-if="credential.globalIdentifier">
          <b class="pr-1">{{ t('msg.credential-global-identifier') }}</b>
          <code class="text-bluegray-600">{{ credential.globalIdentifier }}</code>
        </span>
      </div>
    </template>
    <template #append>
      <div class="flex gap-2">
        <VBtn variant="tonal" prepend-icon="mdi-shield-remove" color="error">
          {{ t('actions.unbind') }}
          <CredentialBindDialog
            action="unbind"
            :id="credential._id"
            :type="credential.type"
            @updated="() => emit('updated')"
          />
        </VBtn>
        <VBtn variant="tonal" prepend-icon="mdi-shield-edit">
          {{ t('actions.rebind') }}
          <CredentialBindDialog
            action="bind"
            :id="credential._id"
            :type="credential.type"
            @updated="() => emit('updated')"
          />
        </VBtn>
        <VBtn variant="tonal" prepend-icon="mdi-note-edit" color="info">
          {{ t('actions.edit-remark') }}
          <CredentialRemarkUpdateDialog
            :id="credential._id"
            :remark="credential.remark"
            @updated="() => emit('updated')"
          />
        </VBtn>
      </div>
    </template>
  </VListItem>
</template>

<script setup lang="ts">
import type { ICredentialDoc } from '@uaaa/server'
import { formatTimestamp } from '~/utils/date'

defineProps<{
  credential: ICredentialDoc
}>()
const emit = defineEmits<{
  updated: []
}>()

const { t } = useI18n()
</script>

<style scoped>
td:first-child {
  text-align: right;
  width: 1%;
  white-space: nowrap;
}
</style>

<i18n>
zhHans:
  data: 凭据信息
  remark: 备注
  validAfter: 生效时间
  validBefore: 失效时间
  validCount: 有效次数
  createdAt: 创建时间
  updatedAt: 更新时间
  lastAccessedAt: 最后访问时间
  accessedCount: 访问次数
  disabled: 是否禁用
  securityLevel: 安全等级
</i18n>
