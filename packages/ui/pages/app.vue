<template>
  <VContainer>
    <VRow>
      <VCol cols="12">
        <VCard :title="t('msg.manage-app')">
          <VList>
            <VListItem
              v-for="app in apps"
              :key="app.appId"
              :title="app.app.name"
              :subtitle="app.app.description"
            >
              <template #append>
                <VBtn
                  icon="mdi-pencil"
                  variant="text"
                  :to="{ path: '/install', query: { appId: app.appId, redirect: route.fullPath } }"
                />
              </template>
            </VListItem>
          </VList>
        </VCard>
      </VCol>
    </VRow>
  </VContainer>
</template>

<script setup lang="ts">
definePageMeta({
  level: 1
})

const { t } = useI18n()
const route = useRoute()

const { data: apps } = await useAsyncData(async () => {
  const resp = await api.user.installation.$get()
  const { installations } = await resp.json()
  return installations
})
</script>
