<template>
  <VMenu>
    <template v-slot:activator="{ props }">
      <VBtn v-bind="props" icon="mdi-translate" variant="text" color="text" />
    </template>
    <VList density="comfortable">
      <VListItem
        v-for="(code, i) of availableLocales"
        :key="i"
        :title="t('current_locale', [], { locale: code })"
        @click="persisted = code"
        :append-icon="persisted === code ? 'mdi-check' : undefined"
      />
    </VList>
  </VMenu>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useLocale } from 'vuetify'

const lang = useRouteQuery('lang')
const { locale, availableLocales, t } = useI18n({ useScope: 'global' })
const { current } = useLocale()
const persisted = useLocalStorage('locale', locale.value)
watch(
  () => persisted.value,
  (value) => {
    if (availableLocales.includes(value)) {
      console.log(`[Locale] Changing locale to ${value}`)
      current.value = locale.value = value
    } else {
      console.log(`[Locale] Invalid locale: ${value}, changing to ${locale.value}`)
      nextTick(() => {
        persisted.value = locale.value
      })
    }
  },
  { immediate: true }
)
if (lang.value) {
  if (typeof lang.value === 'string' && availableLocales.includes(lang.value)) {
    console.log(`[Locale] Persisting locale into ${lang.value}`)
    persisted.value = lang.value
  }
  lang.value = null
}
</script>
