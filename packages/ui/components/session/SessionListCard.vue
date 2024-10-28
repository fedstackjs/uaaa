<template>
  <VCard>
    <VCardTitle class="d-flex align-center">
      <div>{{ t('msg.session-list') }}</div>
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
          v-if="item._id === currentSession"
          color="info"
          :text="t('msg.current-session')"
          class="ml-2"
        />
      </template>
      <template v-slot:[`item.createdAt`]="{ item }">
        <VChip class="font-mono" :text="new Date(item.createdAt).toLocaleString()" />
      </template>
      <template v-slot:[`item.expiresAt`]="{ item }">
        <div class="flex gap-1">
          <VChip class="font-mono mr-2" :text="new Date(item.expiresAt).toLocaleString()" />
          <VChip v-if="item.terminated" color="info" :text="t('msg.terminated')" />
          <VChip v-else-if="item.expiresAt < Date.now()" color="success" :text="t('msg.expired')" />
          <VChip v-else color="warning" :text="t('msg.active')" />
        </div>
      </template>
      <template v-slot:[`item._apps`]="{ item }">
        <div class="flex gap-1">
          <AppAvatar size="36px" v-for="app of item.authorizedApps" :key="app" :appId="app" />
        </div>
      </template>
      <template v-slot:[`item._actions`]="{ item }">
        <div class="flex gap-2 py-1">
          <VBtn :text="t('msg.view')" variant="tonal" :to="`/session/${item._id}`" />
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
const { t } = useI18n()
const headers = [
  { title: t('msg.session-id'), key: '_id', sortable: false, minWidth: '320px' },
  { title: t('msg.session-token-count'), key: 'tokenCount', sortable: false, minWidth: '96px' },
  { title: t('msg.created-at'), key: 'createdAt', sortable: false },
  { title: t('msg.expires-at'), key: 'expiresAt', sortable: false },
  { title: t('msg.session-authorized-apps'), key: '_apps', sortable: false },
  { title: t('msg.actions'), key: '_actions', sortable: false }
] as const

const currentSession = computed(() => api.effectiveToken.value?.decoded.sid)

const { page, perPage, data, cachedCount, status, execute } = usePagination(
  async (skip, limit, doCount) => {
    const resp = await api.user.session.$get({
      query: { skip: '' + skip, limit: '' + limit, count: doCount ? '1' : '0' }
    })
    await api.checkResponse(resp)
    const { sessions, count } = await resp.json()
    return { items: sessions, count }
  }
)

const { run } = useTask(async (id: string) => {
  if (!confirm(t('msg.confirm-operation'))) return symNoToast
  const cachedSessionId = currentSession.value
  const resp = await api.user.session[':id'].terminate.$post({ param: { id } })
  await api.checkResponse(resp)
  if (id === cachedSessionId) {
    api.logout()
  } else {
    execute()
  }
})
</script>
