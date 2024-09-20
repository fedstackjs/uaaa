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
    >
      <template v-slot:[`item._id`]="{ item }">
        <code>{{ item._id }}</code>
      </template>
      <template v-slot:[`item.targetAppId`]="{ item }">
        <AppAvatar v-if="item.targetAppId" :appId="item.targetAppId" />
        <span v-else>{{ t('uaaa') }}</span>
      </template>
      <template v-slot:[`item.clientAppId`]="{ item }">
        <AppAvatar v-if="item.clientAppId" :appId="item.clientAppId" />
        <span v-else>{{ t('client-for', [t('uaaa')]) }}</span>
      </template>
      <template v-slot:[`item.createdAt`]="{ item }">
        <VChip class="font-mono" :text="new Date(item.createdAt).toLocaleString()" />
      </template>
      <template v-slot:[`item.expiresAt`]="{ item }">
        <VChip class="font-mono mr-2" :text="new Date(item.expiresAt).toLocaleString()" />
        <VChip v-if="item.terminated" color="info" :text="t('msg.terminated')" />
        <VChip
          v-else-if="(item.refreshExpiresAt ?? item.expiresAt) < Date.now()"
          color="success"
          :text="t('msg.expired')"
        />
        <VChip
          v-else-if="(item.tokenExpiresAt ?? 0) < Date.now()"
          color="warning"
          :text="t('msg.inactive')"
        />
        <VChip v-else color="warning" :text="t('msg.active')" />
      </template>
      <template v-slot:[`item._actions`]="{ item }">
        <div class="flex gap-2">
          <VBtn :text="t('msg.view')" variant="tonal" />
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
  { title: t('msg.token-id'), key: '_id', sortable: false },
  { title: t('msg.token-index'), key: 'index', sortable: false },
  { title: t('msg.target-app'), key: 'targetAppId', sortable: false },
  { title: t('msg.client-app'), key: 'clientAppId', sortable: false },
  { title: t('msg.created-at'), key: 'createdAt', sortable: false },
  { title: t('msg.expires-at'), key: 'expiresAt', sortable: false },
  { title: t('msg.actions'), key: '_actions', sortable: false }
] as const

const { page, perPage, data, cachedCount, status } = usePagination(async (skip, limit, doCount) => {
  const resp = await api.user.session[':id'].token.$get({
    param: { id: props.sessionId },
    query: { skip: '' + skip, limit: '' + limit, count: doCount ? '1' : '0' }
  })
  await api.checkResponse(resp)
  const { tokens, count } = await resp.json()
  return { items: tokens, count }
})
</script>
