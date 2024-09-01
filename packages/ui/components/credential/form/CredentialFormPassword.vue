<template>
  <VCardText class="flex flex-col gap-2">
    <VTextField v-if="showUserId" v-model="userId" label="User ID" />
    <VTextField v-model="password" label="Password" type="password" />
    <VBtn variant="tonal" :text="t('actions.submit')" :loading="isLoading" @click="execute()" />
  </VCardText>
</template>

<script setup lang="ts">
const props = defineProps<{
  action: 'login' | 'verify' | 'bind' | 'unbind'
  credentialId?: string
  targetLevel?: number
}>()
const emit = defineEmits<{
  updated: [credentialId?: string]
}>()

const { t } = useI18n()
const toast = useToast()

const showUserId = computed(() => props.action === 'login')
const userId = ref('')
const password = ref('')

const { isLoading, execute } = useAsyncState(
  async () => {
    let credentialId: string | undefined
    switch (props.action) {
      case 'login':
        await api.login('password', {
          id: userId.value,
          password: password.value
        })
        break
      case 'verify':
        await api.verify('password', props.targetLevel ?? 0, {
          password: password.value
        })
        break
      case 'bind':
        const resp = await api.user.credential.bind.$put({
          json: {
            type: 'password',
            payload: { password: password.value },
            credentialId: props.credentialId
          }
        })
        const data = await resp.json()
        credentialId = data.credentialId
        break
      case 'unbind':
        if (!props.credentialId) throw new Error('No credentialId')
        await api.user.credential.$delete({
          json: {
            type: 'password',
            payload: { password: password.value },
            credentialId: props.credentialId
          }
        })
        break
    }
    toast.success(t('hint.success'))
    emit('updated', credentialId)
  },
  null,
  { immediate: false }
)
</script>
