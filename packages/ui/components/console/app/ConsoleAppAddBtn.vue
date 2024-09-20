<template>
  <VDialog activator="parent" max-width="1280">
    <template v-slot:activator="{ props }">
      <VBtn :text="t('console.add-app')" variant="tonal" v-bind="props" />
    </template>
    <template v-slot:default="{ isActive }">
      <VCard prepend-icon="mdi-plus" :title="t(`console.add-app`)">
        <AppManifestEditor v-model="manifest" />

        <VCardActions>
          <VBtn :text="t('actions.submit')" @click="onSubmit(isActive)" />
        </VCardActions>
      </VCard>
    </template>
  </VDialog>
</template>

<script setup lang="ts">
import type { IAppManifest } from '@uaaa/server'
import copy from 'copy-to-clipboard'

const emit = defineEmits<{
  updated: []
}>()

const { t } = useI18n()
const toast = useToast()

const manifest = ref<IAppManifest>({
  appId: 'com.example.appid',
  name: 'Example App',
  description: 'This is an example app',
  providedPermissions: [],
  requestedClaims: [
    { name: 'username', reason: '', required: true },
    { name: 'email', reason: '', required: true }
  ],
  requestedPermissions: [],
  callbackUrls: [],
  variables: {},
  secrets: {},
  promoted: true,
  securityLevel: 1
})

async function onSubmit(isActive: Ref<boolean>) {
  const resp = await api.console.app.$post({ json: manifest.value })
  const { appId, secret } = await resp.json()
  copy(secret)
  toast.info('App secret copied to clipboard')
  emit('updated')
  isActive.value = false
}
</script>
