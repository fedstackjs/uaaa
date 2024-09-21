<template>
  <VList density="compact">
    <VListItem
      v-for="{ description, name, path } of data"
      :key="path"
      :title="name"
      :subtitle="description"
      prepend-icon="mdi-plus"
    >
      <template #append>
        <code v-text="path" class="text-sm text-gray" />
      </template>
    </VListItem>
  </VList>
</template>

<script setup lang="ts">
import { URL } from 'whatwg-url'
import { minimatch } from 'minimatch'

const props = defineProps<{
  permission: string
}>()

const { data } = await useAsyncData(async () => {
  const url = new URL(`uperm://${props.permission}`)
  const resp = await api.public.app[':id'].provided_permissions.$get({
    param: { id: url.host }
  })
  await api.checkResponse(resp)
  const { permissions } = await resp.json()
  return permissions.filter((p) => minimatch(p.path, url.pathname || '/'))
})
</script>
