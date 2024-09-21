<template>
  <VCard>
    <VCardTitle class="d-flex align-center">
      <div>{{ t('msg.user-list') }}</div>
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
        <VChip
          v-if="item._id === currentUser"
          color="info"
          :text="t('msg.current-user')"
          class="ml-2"
        />
      </template>
      <template v-slot:[`item._username`]="{ item }">
        {{ item.claims?.username.value }}
      </template>
      <template v-slot:[`item._actions`]="{ item }">
        <div class="flex gap-2"></div>
      </template>
    </VDataTableServer>
  </VCard>
</template>

<script setup lang="ts">
const { t } = useI18n()
const headers = [
  { title: t('msg.user-id'), key: '_id', sortable: false },
  { title: t('msg.username'), key: '_username', sortable: false },
  { title: t('msg.is-disabled'), key: 'disabled', sortable: false },
  { title: t('msg.actions'), key: '_actions', sortable: false }
] as const
const currentUser = computed(() => api.effectiveToken.value?.decoded.sub)

const { page, perPage, data, cachedCount, status, execute } = usePagination(
  async (skip, limit, doCount) => {
    const resp = await api.console.user.$get({
      query: { skip: '' + skip, limit: '' + limit, count: doCount ? '1' : '0' }
    })
    await api.checkResponse(resp)
    const { users, count } = await resp.json()
    console.log(users)
    return { items: users, count }
  }
)
</script>
