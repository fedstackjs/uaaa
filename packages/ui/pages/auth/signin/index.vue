<template>
  <VCardText class="flex flex-col gap-2" v-if="data">
    <VBtn
      v-for="loginType of data.types"
      :key="loginType"
      variant="tonal"
      class="justify-start"
      prepend-icon="mdi-lock"
      :to="`/auth/signin/${loginType}`"
      :text="$t('messages.login-by', [$t(`credentials.${loginType}`)])"
    />
  </VCardText>
</template>

<script setup lang="ts">
const { api } = useApi()

const { data } = await useAsyncData(async () => {
  const resp = await api.public.login.$get()
  return resp.json()
})
</script>
