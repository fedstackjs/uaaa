<template>
  <VAlert v-if="action === 'bind' && credentialId">
    {{ t('do-not-support-rebind') }}
  </VAlert>
  <template v-else>
    <div v-if="action === 'bind'" class="flex justify-center">
      <div>
        <VCheckboxBtn v-model="local" :label="t('msg.use-local-authenticator')" />
      </div>
    </div>
    <VCardActions>
      <VBtn :text="t('verify-passkey')" color="primary" block variant="flat" @click="submit()" />
    </VCardActions>
  </template>
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

const local = ref(true)
const isLoading = ref(false)

async function submit() {
  if (isLoading.value) return
  isLoading.value = true

  try {
    let credentialId: string | undefined
    switch (props.action) {
      case 'login':
        // TODO: support login with webauthn
        break
      case 'verify': {
        const resp = await api.webauthn.verify.$post({
          json: {}
        })
        await api.checkResponse(resp)
        const { options } = await resp.json()
        const payload = await startAuthentication(options)
        await api.verify('webauthn', props.targetLevel ?? 0, payload)
        break
      }
      case 'bind': {
        const resp = await api.webauthn.bind.$post({
          json: { local: local.value }
        })
        await api.checkResponse(resp)
        const { options } = await resp.json()
        const payload = await startRegistration(options)
        const bindResp = await api.user.credential.bind.$put({
          json: { type: 'webauthn', payload, credentialId: props.credentialId }
        })
        await api.checkResponse(bindResp)
        const data = await bindResp.json()
        credentialId = data.credentialId
        break
      }
      case 'unbind': {
        if (!props.credentialId) throw new Error('No credentialId')
        const resp = await api.user.credential.$delete({
          json: {
            type: 'webauthn',
            payload: {},
            credentialId: props.credentialId
          }
        })
        await api.checkResponse(resp)
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

if (['login', 'verify'].includes(props.action)) {
  submit()
}
</script>

<i18n>
zhHans:
  do-not-support-rebind: 通行密钥不支持重新绑定
  verify-passkey: 验证通行密钥
</i18n>
