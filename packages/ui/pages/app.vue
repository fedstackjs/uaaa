<template>
  <VContainer>
    <VRow>
      <VCol cols="12">
        <VCard :title="t('msg.manage-app')">
          <VList v-if="apps?.length">
            <VListItem
              v-for="app in apps"
              :key="app.appId"
              :title="app.app.name"
              :subtitle="app.app.description"
            >
              <template #prepend>
                <AppAvatar :appId="app.appId" :icon="app.app.icon" :name="app.app.name" />
              </template>
              <template #append>
                <VBtn
                  icon="mdi-pencil"
                  variant="text"
                  :to="{ path: '/install', query: { appId: app.appId, redirect: route.fullPath } }"
                />
              </template>
            </VListItem>
          </VList>
          <VAlert v-else type="info" :text="t('msg.no-app-installed')" />
        </VCard>
      </VCol>
    </VRow>
  </VContainer>
</template>

<script setup lang="ts">
definePageMeta({
  level: 2
})

useHead({
  title: 'App Management'
})

const { t } = useI18n()
const route = useRoute()

const { data: apps } = await useAsyncData(async () => {
  const resp = await api.user.installation.$get()
  const { installations } = await resp.json()
  return installations
})
</script>
