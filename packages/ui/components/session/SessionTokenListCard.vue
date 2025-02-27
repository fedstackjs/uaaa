<template>
  <VCard>
    <VCardTitle class="d-flex align-center">
      <div>{{ t('msg.token-list') }}</div>
    </VCardTitle>
    <VDataTableServer
      :headers="headers"
      :items-length="cachedCount"
      :items="data ?? []"
      :items-per-page-options="[15, 30, 50, 100]"
      :loading="status === 'pending'"
      v-model:page="page"
      v-model:items-per-page="perPage"
      item-value="_id"
      density="compact"
    >
      <template v-slot:[`item._id`]="{ item }">
        <code>{{ item._id }}</code>
        <VChip
          v-if="effectiveTokens.includes(item._id)"
          color="info"
          :text="t('msg.current-session')"
          class="ml-2"
        />
      </template>
      <template v-slot:[`item.securityLevel`]="{ item }">
        {{ t(`securityLevel.${item.securityLevel}`) }}
      </template>
      <template v-slot:[`item.targetAppId`]="{ item }">
        <div class="flex gap-1">
          <AppAvatar v-for="app of item.apps" size="36px" :key="app" :appId="app" />
        </div>
      </template>
      <template v-slot:[`item.appId`]="{ item }">
        <AppAvatar size="36px" :appId="item.appId" />
      </template>
      <template v-slot:[`item.createdAt`]="{ item }">
        <VChip class="font-mono" :text="new Date(item.createdAt).toLocaleString()" />
      </template>
      <template v-slot:[`item.expiresAt`]="{ item }">
        <div class="flex gap-1 py-1">
          <VChip class="font-mono mr-2" :text="new Date(item.expiresAt).toLocaleString()" />
          <VChip v-if="item.terminated" color="info" :text="t('msg.terminated')" />
          <VChip
            v-else-if="(item.refreshExpiresAt ?? item.expiresAt) < Date.now()"
            color="success"
            :text="t('msg.expired')"
          />
          <VChip
            v-else-if="(item.jwtExpiresAt ?? 0) < Date.now()"
            color="warning"
            :text="t('msg.inactive')"
          />
          <VChip v-else color="warning" :text="t('msg.active')" />
        </div>
      </template>
      <template v-slot:[`item._actions`]="{ item }">
        <div class="flex gap-2">
          <VBtn
            :text="t('actions.terminate')"
            variant="tonal"
            color="error"
            :disabled="item.terminated"
            @click="run(item._id)"
          />
        </div>
      </template>
    </VDataTableServer>
  </VCard>
</template>

<script setup lang="ts">
const props = defineProps<{
  sessionId: string
}>()
const { t } = useI18n()
const headers = [
  { title: t('msg.token-id'), key: '_id', sortable: false, minWidth: '320px' },
  { title: t('msg.token-index'), key: 'index', sortable: false, minWidth: '96px' },
  { title: t('msg.security-level'), key: 'securityLevel', sortable: false, minWidth: '96px' },
  { title: t('msg.target-app'), key: 'targetAppId', sortable: false, minWidth: '96px' },
  { title: t('msg.client-app'), key: 'appId', sortable: false, minWidth: '96px' },
  { title: t('msg.created-at'), key: 'createdAt', sortable: false },
  { title: t('msg.expires-at'), key: 'expiresAt', sortable: false },
  { title: t('msg.actions'), key: '_actions', sortable: false }
] as const

const effectiveTokens = computed(() =>
  Object.values(api.tokens.value).map((token) => token.decoded.jti)
)
const effectiveToken = computed(() => api.effectiveToken.value?.decoded.jti)

const { page, perPage, data, cachedCount, status, execute } = usePagination(
  async (skip, limit, doCount) => {
    const resp = await api.user.session[':id'].token.$get({
      param: { id: props.sessionId },
      query: { skip: '' + skip, limit: '' + limit, count: doCount ? '1' : '0' }
    })
    await api.checkResponse(resp)
    const { tokens, count } = await resp.json()
    return {
      items: tokens.map((token) => ({
        ...token,
        apps: [
          ...new Set(token.permissions.map((perm) => Permission.fromCompactString(perm).appId))
        ]
      })),
      count
    }
  }
)

const { run } = useTask(async (id: string) => {
  if (!confirm(t('msg.confirm-operation'))) return symNoToast
  const resp = await api.user.session[':id'].token[':tokenId'].terminate.$post({
    param: { id: props.sessionId, tokenId: id }
  })
  await api.checkResponse(resp)
  execute()
})
</script>
