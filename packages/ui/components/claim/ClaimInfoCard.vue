<template>
  <VCard :title="t('msg.user-settings')">
    <VTable v-if="data">
      <tbody>
        <tr v-for="item of data" :key="item.name">
          <td>{{ t(`claims.${item.name}`) }}</td>
          <td>
            <code>{{ item.value }}</code>
          </td>
          <td>
            <VIcon v-if="item.verified" color="success" icon="mdi-shield-check" />
            <VIcon v-else color="primary" icon="mdi-pencil" @click="edit(item.name, item.value)" />
          </td>
        </tr>
      </tbody>
    </VTable>
    <ClaimInfoEditDialog
      v-model="editDialogOpen"
      :name="editName"
      :value="editValue"
      @updated="refresh()"
    />
  </VCard>
</template>

<script setup lang="ts">
const { t } = useI18n()

const { data, refresh } = await useAsyncData(async () => {
  return api.getUserClaims()
})

const editDialogOpen = ref(false)
const editName = ref('')
const editValue = ref('')

function edit(name: string, value: string) {
  editName.value = name
  editValue.value = value
  editDialogOpen.value = true
}
</script>

<style scoped>
td:first-child,
td:last-child {
  text-align: right;
  width: 1%;
  white-space: nowrap;
}
</style>
