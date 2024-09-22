<template>
  <VCardActions>
    <VBtn
      :text="t('redirect-to-iaaa')"
      color="#9b0000"
      block
      variant="flat"
      @click="submit()"
      :loading="isLoading"
      prepend-icon="svg:M4.67,5.18l1.83-.23v4.13c0,.29,.02,.5,.06,.63s.1,.24,.2,.33c.12,.11,.34,.2,.65,.26v.13h-2.8v-.13c.25-.03,.44-.08,.55-.14,.11-.06,.2-.17,.27-.31,.05-.1,.08-.24,.1-.44,.02-.2,.03-.48,.03-.85v-1.56c0-.43-.01-.74-.03-.91-.02-.17-.07-.32-.14-.43-.07-.12-.16-.2-.26-.26-.1-.05-.25-.09-.44-.1v-.13Zm1.32-2.5c-.17,0-.3-.05-.41-.16s-.16-.24-.16-.4,.05-.29,.17-.4c.11-.11,.25-.16,.41-.16s.3,.05,.41,.16,.17,.24,.17,.4-.05,.29-.16,.4-.25,.16-.41,.16ZM22.75,22.44h-4.27v-.15c.39-.03,.65-.1,.81-.2,.27-.17,.4-.4,.4-.7,0-.18-.06-.42-.18-.72l-.11-.27-.62-1.53h-2.86l-.34,.9-.16,.4c-.2,.48-.29,.85-.29,1.13,0,.16,.04,.31,.11,.45s.17,.25,.29,.34c.17,.12,.39,.19,.65,.21v.15h-2.91v-.15c.23-.01,.43-.07,.6-.17s.34-.26,.51-.48c.14-.18,.27-.41,.41-.69s.31-.7,.52-1.26l2.38-6.13h.37l2.83,6.84c.21,.52,.38,.88,.51,1.11s.26,.39,.41,.5c.1,.08,.22,.14,.36,.18s.34,.08,.6,.11v.15Zm-4.08-3.84l-1.37-3.37-1.29,3.37h2.65ZM0,12v12H12V12H0Zm10.75,10.44H6.48v-.15c.39-.03,.65-.1,.81-.2,.27-.17,.4-.4,.4-.7,0-.18-.06-.42-.18-.72l-.11-.27-.62-1.53H3.91l-.34,.9-.16,.4c-.2,.48-.29,.85-.29,1.13,0,.16,.04,.31,.11,.45,.07,.14,.17,.25,.29,.34,.17,.12,.39,.19,.65,.21v.15H1.25v-.15c.23-.01,.43-.07,.6-.17,.17-.1,.34-.26,.51-.48,.14-.18,.27-.41,.41-.69s.31-.7,.52-1.26l2.38-6.13h.37l2.83,6.84c.21,.52,.38,.88,.51,1.11,.13,.22,.26,.39,.41,.5,.1,.08,.22,.14,.36,.18,.13,.04,.34,.08,.6,.11v.15Zm-6.74-3.84h2.65l-1.37-3.37-1.29,3.37ZM12,0V12h12V0H12Zm10.75,10.44h-4.27v-.15c.39-.03,.65-.1,.81-.2,.27-.17,.4-.4,.4-.7,0-.18-.06-.42-.18-.72l-.11-.27-.62-1.53h-2.86l-.34,.9-.16,.4c-.2,.48-.29,.85-.29,1.13,0,.16,.04,.31,.11,.45,.07,.14,.17,.25,.29,.34,.17,.12,.39,.19,.65,.21v.15h-2.91v-.15c.23-.01,.43-.07,.6-.17,.17-.1,.34-.26,.51-.48,.14-.18,.27-.41,.41-.69s.31-.7,.52-1.26l2.38-6.13h.37l2.83,6.84c.21,.52,.38,.88,.51,1.11,.13,.22,.26,.39,.41,.5,.1,.08,.22,.14,.36,.18,.13,.04,.34,.08,.6,.11v.15Zm-6.74-3.84h2.65l-1.37-3.37-1.29,3.37Z"
    />
  </VCardActions>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  action: 'login' | 'verify' | 'bind' | 'unbind'
  credentialId?: string
  targetLevel?: number
}>()
const emit = defineEmits<{
  updated: [credentialId?: string]
}>()

const { t } = useI18n()
const authRedirect = useLocalStorage('authRedirect', '')

const { running: isLoading, run: submit } = useTask(async () => {
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
      await api.checkResponse(resp)
      const data = await resp.json()
      credentialId = data.credentialId
      break
    }
    case 'unbind': {
      if (!props.credentialId) throw new Error('No credentialId')
      const resp = await api.user.credential.$delete({
        json: {
          type: 'iaaa',
          payload: {},
          credentialId: props.credentialId
        }
      })
      await api.checkResponse(resp)
      break
    }
  }
  emit('updated', credentialId)
})
</script>

<i18n>
zh-Hans:
  redirect-to-iaaa: 转到北京大学统一身份认证
</i18n>
