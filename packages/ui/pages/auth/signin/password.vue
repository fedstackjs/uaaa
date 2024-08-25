<template>
  <VCardText class="flex flex-col gap-2">
    <VTextField v-model="userId" label="User ID" />
    <VTextField v-model="password" label="Password" type="password" />
    <VBtn variant="tonal" :text="$t('actions.submit')" :loading="isLoading" @click="execute()" />
  </VCardText>
</template>

<script setup lang="ts">
const { api } = useApi()
const toast = useToast()

const userId = ref('')
const password = ref('')

const { isLoading, execute } = useAsyncState(
  async () => {
    const resp = await api.public.login.$post({
      json: {
        type: 'password',
        payload: {
          id: userId.value,
          password: password.value
        }
      }
    })
    if (resp.ok) {
      //
      const { tokens } = await resp.json()
    } else {
      toast.error('Failed to login')
    }
  },
  null,
  { immediate: false }
)
</script>
