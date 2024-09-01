<template>
  <VCard :title="t('session-info')">
    <VTable v-if="info">
      <tbody>
        <tr>
          <td>{{ t('token-count') }}</td>
          <td>
            <code>{{ info.tokenCount }}</code>
          </td>
        </tr>
        <tr>
          <td>{{ t('authorized-apps') }}</td>
          <td>
            <code>{{ info.authorizedApps.length }}</code>
          </td>
        </tr>
        <tr>
          <td>{{ t('jti') }}</td>
          <td>
            <code>{{ effectiveToken?.decoded.jti }}</code>
          </td>
        </tr>
        <tr>
          <td>{{ t('level') }}</td>
          <td>{{ effectiveToken?.decoded.level }}</td>
        </tr>
        <tr>
          <td>{{ t('sid') }}</td>
          <td>
            <code>{{ effectiveToken?.decoded.sid }}</code>
          </td>
        </tr>
      </tbody>
    </VTable>
  </VCard>
</template>

<script setup lang="ts">
const { t } = useI18n()

const { effectiveToken } = api

const { data: info } = useAsyncData(async () => {
  const resp = await api.session.index.$get()
  return resp.json()
})
</script>

<style scoped>
/* For every first td in tr, set text-align to right */
td:first-child {
  text-align: right;
  width: 1%;
  white-space: nowrap;
}
</style>

<i18n>
zhHans:
  token-info: 令牌信息
  property: 属性
  value: 值
  jti: 令牌ID
  sid: 会话ID
  level: 安全等级
  perm: 权限
  session-info: 会话信息
  token-count: 令牌数量 
  authorized-apps: 授权应用数
</i18n>
