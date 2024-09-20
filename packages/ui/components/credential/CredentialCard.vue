<template>
  <VCard>
    <CredentialItem :credential="credential" />
    <VDivider />
    <VTable density="compact">
      <tbody>
        <tr>
          <td>{{ t('data') }}</td>
          <td>
            <code>{{ credential.data }}</code>
          </td>
        </tr>
        <tr>
          <td>{{ t('remark') }}</td>
          <td>
            <code>{{ credential.remark }}</code>
          </td>
        </tr>
        <tr v-if="credential.validAfter">
          <td>{{ t('validAfter') }}</td>
          <td>
            <code>{{ formatTimestamp(credential.validAfter) }}</code>
          </td>
        </tr>
        <tr v-if="credential.validBefore">
          <td>{{ t('validBefore') }}</td>
          <td>
            <code>{{ formatTimestamp(credential.validBefore) }}</code>
          </td>
        </tr>
        <tr v-if="credential.validCount">
          <td>{{ t('validCount') }}</td>
          <td>
            <code>{{ credential.validCount }}</code>
          </td>
        </tr>
        <tr>
          <td>{{ t('createdAt') }}</td>
          <td>
            <code>{{ formatTimestamp(credential.createdAt) }}</code>
          </td>
        </tr>
        <tr>
          <td>{{ t('updatedAt') }}</td>
          <td>
            <code>{{ formatTimestamp(credential.updatedAt) }}</code>
          </td>
        </tr>
        <tr v-if="credential.lastAccessedAt">
          <td>{{ t('lastAccessedAt') }}</td>
          <td>
            <code>{{ formatTimestamp(credential.lastAccessedAt) }}</code>
          </td>
        </tr>
        <tr v-if="credential.accessedCount">
          <td>{{ t('accessedCount') }}</td>
          <td>
            <code>{{ credential.accessedCount }}</code>
          </td>
        </tr>
        <tr v-if="credential.disabled">
          <td>{{ t('disabled') }}</td>
          <td>
            <code>{{ credential.disabled }}</code>
          </td>
        </tr>
        <tr>
          <td>{{ t('securityLevel') }}</td>
          <td>
            <code>{{ credential.securityLevel }}</code>
          </td>
        </tr>
      </tbody>
    </VTable>
  </VCard>
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
