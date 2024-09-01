<template>
  <VAppBar border>
    <VAppBarNavIcon @click="model = !model" />
    <VToolbarItems>
      <VBtn to="/" rounded="lg" :active="false">
        <template #prepend>
          <VIcon size="48">mdi-lock</VIcon>
        </template>
        <div v-if="mdAndUp" class="text-none pl-4 font-mono text-3xl">
          {{ config.public.appName }}
          <span v-if="console">{{ t('pages.console.index') }}</span>
        </div>
      </VBtn>
    </VToolbarItems>

    <VSpacer></VSpacer>

    <UiUserMenu />
  </VAppBar>
</template>

<script setup lang="ts">
import { useDisplay } from 'vuetify'

const model = defineModel<boolean>()
defineProps<{
  console?: boolean
}>()

const config = useRuntimeConfig()
const { t } = useI18n()
const { mdAndUp } = useDisplay()
</script>
