<template>
  <VContainer class="fill-height justify-center">
    <VCard class="min-w-xs lg:min-w-md">
      <VCardTitle class="d-flex flex-col items-center">
        <VIcon size="128">
          <CommonLogo variant="flat" />
        </VIcon>
        <div>{{ t('pages.authorize') }}</div>
      </VCardTitle>
      <VDivider />
      <VAlert
        v-if="'error' in params"
        type="error"
        :text="t('msg.bad-arguments', [params.error])"
      />
      <SessionAuthorize v-else :params="params" />
    </VCard>
  </VContainer>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'plain',
  middleware: 'verifyauth'
})
useHead({
  title: 'Authorize'
})

const { t } = useI18n()
const { params } = useAuthorize()
</script>
