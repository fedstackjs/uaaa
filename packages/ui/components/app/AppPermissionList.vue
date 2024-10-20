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
        <div class="text-right">
          <div>
            <code v-text="url.host" class="text-sm text-gray" />
          </div>
          <div>
            <code v-text="path" class="text-sm text-gray" />
          </div>
        </div>
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

const url = computed(() => new URL(`uperm://${props.permission}`))

const { data } = await useAsyncData(props.permission, async () => {
  const resp = await api.public.app[':id'].provided_permissions.$get({
    param: { id: url.value.host }
  })
  await api.checkResponse(resp)
  const { permissions } = await resp.json()
  return permissions.filter((p) => minimatch(p.path, url.value.pathname || '/'))
})
</script>
