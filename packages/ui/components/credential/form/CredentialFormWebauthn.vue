<template>
  <VAlert v-if="action === 'bind' && credentialId">
    {{ t('do-not-support-rebind') }}
  </VAlert>
  <VCardActions v-else>
    <VBtn :text="t('verify-passkey')" color="primary" block variant="flat" @click="submit()" />
  </VCardActions>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'vue-toastification'
import { startRegistration, startAuthentication } from '@simplewebauthn/browser'

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

const isLoading = ref(false)

async function submit() {
  isLoading.value = true

  try {
    let credentialId: string | undefined
    switch (props.action) {
      case 'login':
        // TODO: support login with webauthn
        break
      case 'verify': {
        const resp = await api.webauthn.verify.$post()
        const { options } = await resp.json()
        const payload = await startAuthentication(options)
        await api.verify('webauthn', props.targetLevel ?? 0, payload)
        break
      }
      case 'bind': {
        const resp = await api.webauthn.bind.$post()
        const { options } = await resp.json()
        const payload = await startRegistration(options)
        const bindResp = await api.user.credential.bind.$put({
          json: { type: 'webauthn', payload, credentialId: props.credentialId }
        })
        const data = await bindResp.json()
        credentialId = data.credentialId
        break
      }
      case 'unbind': {
        if (!props.credentialId) throw new Error('No credentialId')
        await api.user.credential.$delete({
          json: {
            type: 'webauthn',
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
  do-not-support-rebind: 通行密钥不支持重新绑定
  verify-passkey: 验证通行密钥
</i18n>
