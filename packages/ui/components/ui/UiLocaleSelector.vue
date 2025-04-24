<template>
  <VMenu>
    <template v-slot:activator="{ props }">
      <VBtn v-bind="props" icon="mdi-translate" variant="text" color="text" />
    </template>
    <VList density="comfortable">
      <VListItem
        v-for="locale of locales"
        :key="locale.code"
        :title="locale.name"
        @click="persisted = locale.code"
        :append-icon="persisted === locale.code ? 'mdi-check' : undefined"
      />
    </VList>
  </VMenu>
</template>

<script setup lang="ts">
import { useLocale } from 'vuetify'

const lang = useRouteQuery('lang')
const { locale, locales, setLocale } = useI18n({ useScope: 'global' })
const { current } = useLocale()
type Locale = typeof locale.value
const persisted = useLocalStorage<Locale>('locale', locale.value)
watch(
  () => persisted.value,
  (value) => {
    if (locales.value.some((locale) => locale.code === value)) {
      console.log(`[Locale] Changing locale to ${value}`)
      current.value = value
      setLocale(value)
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
  if (
    typeof lang.value === 'string' &&
    locales.value.some((locale) => locale.code === lang.value)
  ) {
    console.log(`[Locale] Persisting locale into ${lang.value}`)
    persisted.value = lang.value as Locale
  }
  lang.value = null
}
</script>
