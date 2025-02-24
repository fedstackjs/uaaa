<template>
  <VForm v-if="requireCode" fast-fail validate-on="submit lazy" @submit.prevent="submit">
    <VCardText>
      <p class="pb-4">{{ t('msg.email-email-hint') }}</p>
      <VRow no-gutters>
        <VCol>
          <VTextField
            v-model="email"
            :prepend-inner-icon="mdAndUp ? 'mdi-email' : ''"
            :label="t('credentials.email')"
            :rules="emailRules"
            density="compact"
            :disabled="sendCodeRunning"
            @keydown.enter.prevent.stop="sendCode"
          />
        </VCol>
        <VCol cols="auto" class="pl-2">
          <VBtn
            rounded="1"
            :prepend-icon="mdAndUp ? 'mdi-send' : ''"
            :loading="sendCodeRunning"
            @click="sendCode"
            block
          >
            {{ t('actions.send-otp') }}
          </VBtn>
        </VCol>
      </VRow>
      <p>{{ t('msg.email-otp-hint') }}</p>
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
import { useDisplay, type SubmitEventPromise } from 'vuetify'
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
const toast = useToast()
const errToast = useErrorToast()
const { mdAndUp } = useDisplay()

const requireCode = computed(() => props.action !== 'unbind')
const email = ref('')
const code = ref('')

const emailRules = [
  (value: string) => {
    const re = /\S+@\S+\.\S+/
    if (re.test(value)) return true
    return t('hint.violate-email-rule')
  }
]

const isLoading = ref(false)

const { run: sendCode, running: sendCodeRunning } = useTask(async () => {
  try {
    const resp = await api.email.send.$post({ json: { email: email.value } })
    await api.checkResponse(resp)
    toast.success(t('hint.email-sent'))
    return symNoToast
  } catch (err) {
    throw err
  }
})

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
      case 'bind': {
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
      }
      case 'unbind': {
        if (!props.credentialId) throw new Error('No credentialId')
        const resp = await api.user.credential.$delete({
          json: {
            type: 'email',
            payload: { email: email.value, code: code.value },
            credentialId: props.credentialId
          }
        })
        if (!resp.ok) throw await api.getError(resp)
        break
      }
    }
    toast.success(t('msg.task-succeeded'))
    emit('updated', credentialId)
  } catch (err) {
    errToast.notify(err)
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
zh-Hans:
  hint:
    violate-email-rule: 邮箱地址无效
    violate-code-rule: 验证码无效
    email-sent: 邮件已发送
    email-send-failed: '邮件发送失败: {msg}'
    wrong-credentials: 邮箱或验证码错误
    success: 成功
</i18n>
