<template>
  <VAppBar border>
    <VAppBarNavIcon @click="model = !model" />
    <VToolbarItems>
      <VBtn to="/" rounded="lg" :active="false">
        <VIcon size="42">
          <CommonLogo />
        </VIcon>
        <div v-if="mdAndUp" class="text-none pl-4 font-mono text-3xl">
          {{ config.public.appName }}
        </div>
      </VBtn>
    </VToolbarItems>

    <VSpacer></VSpacer>

    <UiUserMenu :dense="!mdAndUp" />
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
