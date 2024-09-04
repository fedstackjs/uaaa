<template>
  <VContainer class="fill-height justify-center">
    <VCard class="min-w-md">
      <VCardTitle class="d-flex justify-center">
        <div>{{ t('pages.authorize') }}</div>
      </VCardTitle>
      <VDivider />
      <SessionAuthorize v-if="connector instanceof Connector" :connector="connector" />
      <VAlert v-else type="error" :text="t('msg.bad-arguments')" />
    </VCard>
  </VContainer>
</template>

<script setup lang="ts">
import { Connector } from '~/utils/connector'

definePageMeta({
  layout: 'plain',
  middleware: 'verifyauth'
})
useHead({
  title: 'Authorize'
})

const { t } = useI18n()

const type = useRouteQuery<string>('type', '')
const connector = useConnector(type.value)
</script>
