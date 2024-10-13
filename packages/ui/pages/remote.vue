<template>
  <VContainer class="fill-height justify-center">
    <VCard class="min-w-md">
      <VCardTitle class="d-flex flex-col items-center">
        <VIcon size="128">
          <CommonLogo variant="flat" />
        </VIcon>
        <div>{{ t('pages.remote-authorize') }}</div>
      </VCardTitle>
      <VCardText>
        <VAlert
          type="warning"
          :text="t('msg.remote-warn', { code: userCode })"
          class="whitespace-pre"
        />
      </VCardText>
      <VDivider />
      <div class="flex justify-center items-center uppercase!">
        <VTextField
          :rules="userCodeRules"
          :disabled="remoteAuthorizeRunning"
          v-model="userCode"
          :label="t('msg.user-code')"
          :rounded="0"
        />
      </div>
      <VFadeTransition mode="out-in">
        <VCardActions v-if="connected" class="flex-col">
          <div class="self-stretch">
            <VBtn
              block
              color="success"
              readonly
              variant="tonal"
              prepend-icon="mdi-check-circle-outline"
              :text="t('msg.remote-connected')"
            />
          </div>
          <div class="self-stretch flex gap-2">
            <div class="flex-1">
              <VBtn color="primary" variant="tonal" block @click="doRemoteAuthorize">
                {{ t('actions.continue') }}
              </VBtn>
            </div>
            <div class="flex-1">
              <VBtn color="error" variant="tonal" block @click="cancelRemoteAuthorize">
                {{ t('actions.cancel') }}
              </VBtn>
            </div>
          </div>
        </VCardActions>
        <VCardActions>
          <VBtn
            color="primary"
            variant="tonal"
            block
            :disabled="!canAuthorize"
            :loading="remoteAuthorizeRunning"
            @click="startRemoteAuthorize"
          >
            {{ t('msg.start-remote-authorize') }}
          </VBtn>
        </VCardActions>
      </VFadeTransition>
    </VCard>
  </VContainer>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'plain',
  middleware: 'verifyauth'
})
useHead({
  title: 'Remote Authorize'
})

const { t } = useI18n()
const {
  userCode,
  connected,
  canAuthorize,
  startRemoteAuthorize,
  remoteAuthorizeRunning,
  userCodeRules,
  doRemoteAuthorize,
  cancelRemoteAuthorize
} = useRemoteAuthorizeUser()
</script>
