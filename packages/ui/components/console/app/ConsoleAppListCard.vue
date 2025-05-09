<template>
  <VCard>
    <VCardTitle>
      <div class="flex justify-between items-center">
        <div>{{ t('console.app-list') }}</div>
        <div>
          <ConsoleAppAddBtn @updated="refresh()" />
        </div>
      </div>
    </VCardTitle>
    <VDataTable v-if="apps" :items="apps" :headers="headers">
      <template v-slot:item.actions="{ item }">
        <VBtn icon="mdi-pencil" variant="text" @click="onEdit(item)" />
        <VBtn icon="mdi-delete" variant="text" @click="onDelete(item)" :loading="deleteRunning" />
      </template>
    </VDataTable>
    <ConsoleAppEditDialog v-model="editDialogOpen" @updated="refresh()" :manifest="value" />
  </VCard>
</template>

<script setup lang="ts">
import type { IAppDoc, IAppManifest } from '@uaaa/server'

const { t } = useI18n()

const headers = [
  { title: t('id'), value: '_id' },
  { title: t('name'), value: 'name' },
  { title: t('description'), value: 'description' },
  { title: t('security-level'), value: 'securityLevel' },
  { title: t('actions'), value: 'actions', align: 'end', sortable: false }
] as const

const { data: apps, refresh } = await useAsyncData(async () => {
  const resp = await api.console.app.$get()
  const { apps } = await resp.json()
  return apps
})

const value = ref<IAppManifest>({} as IAppManifest)
const editDialogOpen = ref(false)

function onEdit({ _id, ...doc }: IAppDoc) {
  value.value = { appId: _id, ...doc }
  editDialogOpen.value = true
}

const { run: onDelete, running: deleteRunning } = useTask(async ({ _id }: IAppDoc) => {
  if (!confirm(t('confirm-delete'))) return
  const resp = await api.console.app[':id'].$delete({ param: { id: _id } })
  await api.checkResponse(resp)
  refresh()
})
</script>

<i18n>
zh-Hans:
  id: ID
  name: 名称
  description: 描述
  promoted: 推荐
  security-level: 安全等级
  actions: 操作
  confirm-delete: 确认删除应用？所有用户安装将被删除。
</i18n>
