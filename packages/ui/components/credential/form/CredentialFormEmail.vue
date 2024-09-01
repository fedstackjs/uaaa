<template>
  <VForm v-if="requireCode" fast-fail validate-on="submit lazy" @submit.prevent="submit">
    <VCardText>
      <VTextField
        v-model="email"
        prepend-inner-icon="i-mdi:email"
        :label="t('credentials.email')"
        :rules="emailRules"
        :append-icon="emailIcon"
        @click:append="sendCode"
        @keydown.enter.prevent.stop="sendCode"
      />

      <VOtpInput v-model.trim="code" />
    </VCardText>

    <VCardActions>
      <VBtn
        :disabled="code.length !== 6"
        :loading="isLoading"
        type="submit"
        color="primary"
        block
        variant="flat"
      >
        {{ t(`actions.${action}`) }}
      </VBtn>
    </VCardActions>
  </VForm>
  <VCardActions v-else>
    <VBtn :loading="isLoading" color="primary" block variant="flat" @click="submit()">
      {{ t(`actions.${action}`) }}
    </VBtn>
  </VCardActions>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'vue-toastification'
import type { SubmitEventPromise } from 'vuetify'

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

const requireCode = computed(() => props.action !== 'unbind')
const email = ref('')
const emailIcon = ref('i-mdi:send')
const emailSending = ref(false)
const code = ref('')

const emailRules = [
  (value: string) => {
    const re = /\S+@\S+\.\S+/
    if (re.test(value)) return true
    return t('hint.violate-email-rule')
  }
]

const isLoading = ref(false)

async function sendCode() {
  if (emailSending.value) return
  emailSending.value = true
  emailIcon.value = 'i-mdi:send-clock'
  try {
    await api.email.send.$post({ json: { email: email.value } })
    toast.success(t('hint.email-sent'))
    emailIcon.value = 'i-mdi:send-check'
  } catch (err) {
    toast.error(t('hint.email-send-failed', { msg: await prettyHTTPError(err) }))
    emailIcon.value = 'i-mdi:send'
  }
  emailSending.value = false
}

async function submit(ev?: SubmitEventPromise) {
  isLoading.value = true
  if (ev) {
    const result = await ev
    if (!result.valid) return
  }

  try {
    let credentialId: string | undefined
    switch (props.action) {
      case 'login':
        await api.login('email', {
          email: email.value,
          code: code.value
        })
        break
      case 'verify':
        await api.verify('email', props.targetLevel ?? 0, {
          email: email.value,
          code: code.value
        })
        break
      case 'bind':
        const resp = await api.user.credential.bind.$put({
          json: {
            type: 'email',
            payload: { email: email.value, code: code.value },
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
            type: 'email',
            payload: { email: email.value, code: code.value },
            credentialId: props.credentialId
          }
        })
        break
    }
    toast.success(t('hint.success'))
    emit('updated', credentialId)
  } catch (err) {
    toast.error(t('hint.wrong-credentials'))
  }
  isLoading.value = false
}
</script>

<i18n>
en:
  hint:
    violate-email-rule: Invalid email address
    violate-code-rule: Invalid code
    email-sent: Email sent
    email-send-failed: 'Failed to send email: {msg}'
    wrong-credentials: Wrong email or code
    success: Operation succeeded
zhHans:
  hint:
    violate-email-rule: 邮箱地址无效
    violate-code-rule: 验证码无效
    email-sent: 邮件已发送
    email-send-failed: '邮件发送失败: {msg}'
    wrong-credentials: 邮箱或验证码错误
    success: 成功
</i18n>
