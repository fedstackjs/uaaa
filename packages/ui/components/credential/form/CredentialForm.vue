<template>
  <component v-if="components[type]" :is="components[type]" v-bind="$attrs" />
  <VAlert type="error" v-else>{{ t('msg.unknown-credential-type') }}</VAlert>
</template>

<script setup lang="ts">
import CredentialFormEmail from './CredentialFormEmail.vue'
import CredentialFormIAAA from './CredentialFormIAAA.vue'
import CredentialFormPassword from './CredentialFormPassword.vue'
import CredentialFormWebauthn from './CredentialFormWebauthn.vue'
import CredentialFormTOTP from './CredentialFormTOTP.vue'

defineProps<{
  type: string
}>()

const { t } = useI18n()

const components: Record<string, Component> = {
  email: CredentialFormEmail,
  password: CredentialFormPassword,
  webauthn: CredentialFormWebauthn,
  iaaa: CredentialFormIAAA,
  totp: CredentialFormTOTP
}
</script>
