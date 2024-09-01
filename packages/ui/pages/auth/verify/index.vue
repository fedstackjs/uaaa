<template>
  <VCardText class="flex flex-col gap-2" v-if="data">
    <VBtn
      v-for="type of data.types"
      :key="type"
      variant="tonal"
      class="justify-start"
      prepend-icon="i-mdi:lock"
      :to="{ path: `/auth/verify/${type}`, query: route.query }"
      :text="t('msg.verify-by', [t(`credentials.${type}`)])"
    />
  </VCardText>
</template>

<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const targetLevel = useRouteQuery('targetLevel', '0')

const { data } = await useAsyncData(async () => {
  const resp = await api.session.elevate.$get({ query: { targetLevel: targetLevel.value } })
  return resp.json()
})
</script>
