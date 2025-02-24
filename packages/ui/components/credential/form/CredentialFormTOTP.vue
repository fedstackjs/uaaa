<template>
  <VAlert v-if="action === 'login'">
    {{ t('do-not-support-login') }}
  </VAlert>
  <template v-else-if="action === 'verify'">
    <VCardText class="flex flex-col gap-2">
      <VOtpInput v-model="code" :label="t('msg.otp-code')" />
      <VBtn variant="tonal" :text="t('actions.submit')" :loading="isLoading" @click="submit()" />
    </VCardText>
  </template>
  <template v-else-if="action === 'bind'">
    <VCardText class="flex flex-col gap-2">
      <VImg :src="secret?.svgUrl" />
      <VOtpInput v-model="code" :label="t('msg.otp-code')" />
      <VBtn variant="tonal" :text="t('actions.submit')" :loading="isLoading" @click="submit()" />
    </VCardText>
  </template>
  <template>
    <VCardText class="flex flex-col gap-2">
      <VBtn variant="tonal" :text="t('actions.confirm')" :loading="isLoading" @click="submit()" />
    </VCardText>
  </template>
</template>

<script setup lang="ts">
import type { SecurityLevel } from '~/utils/api'

const props = defineProps<{
  action: 'login' | 'verify' | 'bind' | 'unbind'
  credentialId?: string
  targetLevel?: SecurityLevel
}>()
const emit = defineEmits<{
  updated: [credentialId?: string]
}>()

const { t } = useI18n()

const code = ref('')
const { data: secret } = await useAsyncData(async () => {
  if (props.action !== 'bind') return { secret: '', url: '', svgUrl: '' }
  return generateTOTPSecretUrl()
})

const { running: isLoading, run: submit } = useTask(async () => {
  let credentialId: string | undefined
  switch (props.action) {
    case 'verify':
      await api.verify('totp', props.targetLevel ?? 0, { code: code.value })
      break
    case 'bind':
      if (!secret.value) return
      const resp = await api.user.credential.bind.$put({
        json: {
          type: 'totp',
          payload: { secret: secret.value.secret, code: code.value },
          credentialId: props.credentialId
        }
      })
      await api.checkResponse(resp)
      const data = await resp.json()
      credentialId = data.credentialId
      clearCachedTOTPSecret()
      break
    case 'unbind':
      if (!props.credentialId) throw new Error('No credentialId')
      await api.user.credential.$delete({
        json: {
          type: 'password',
          payload: {},
          credentialId: props.credentialId
        }
      })
      break
  }
  emit('updated', credentialId)
})
</script>
