<template>
  <VMenu>
    <template v-slot:activator="{ props }">
      <VBtn v-bind="props" icon="i-mdi:translate" variant="text" />
    </template>
    <VList density="comfortable">
      <VListItem
        v-for="(code, i) of availableLocales"
        :key="i"
        :title="t('current_locale', [], { locale: code })"
        @click="locale = code"
      />
    </VList>
  </VMenu>
</template>

<script setup lang="ts">
import { syncRef } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { useLocale } from 'vuetify'

const { locale, availableLocales, t } = useI18n({ useScope: 'global' })
const { current } = useLocale()
syncRef(locale, current)
</script>
