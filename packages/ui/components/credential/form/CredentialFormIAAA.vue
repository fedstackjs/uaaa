<template>
  <VCardActions>
    <VBtn :text="t('redirect-to-iaaa')" color="primary" block variant="flat" @click="submit()" />
  </VCardActions>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'vue-toastification'

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
const authRedirect = useLocalStorage('authRedirect', '')

const isLoading = ref(false)

async function submit() {
  isLoading.value = true

  try {
    authRedirect.value = 'false'
    const token = await getIAAAToken()
    let credentialId: string | undefined
    switch (props.action) {
      case 'login':
        await api.login('iaaa', { token })
        break
      case 'verify': {
        await api.verify('iaaa', props.targetLevel ?? 0, { token })
        break
      }
      case 'bind': {
        const resp = await api.user.credential.bind.$put({
          json: { type: 'iaaa', payload: { token }, credentialId: props.credentialId }
        })
        const data = await resp.json()
        credentialId = data.credentialId
        break
      }
      case 'unbind': {
        if (!props.credentialId) throw new Error('No credentialId')
        await api.user.credential.$delete({
          json: {
            type: 'iaaa',
            payload: {},
            credentialId: props.credentialId
          }
        })
        break
      }
    }
    toast.success(t('msg.task-succeeded'))
    emit('updated', credentialId)
  } catch (err) {
    console.log(err)
    toast.error(t('msg.task-failed'))
  }

  isLoading.value = false
}
</script>

<i18n>
zhHans:
  redirect-to-iaaa: 北京大学统一身份认证
</i18n>
