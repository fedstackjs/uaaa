<template>
  <VAppBar border>
    <VAppBarNavIcon v-if="showNavIcon" @click="model = !model" />
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

    <UiUserMenu v-if="showUserMenu" :dense="!mdAndUp" />
    <UiLocaleSelector v-if="!showNavIcon" />
  </VAppBar>
</template>

<script setup lang="ts">
import { useDisplay } from 'vuetify'

const model = defineModel<boolean>()
const props = defineProps<{ mode?: 'authorize' | 'console' | 'plain' }>()

const config = useRuntimeConfig()
const { mdAndUp } = useDisplay()

const showNavIcon = computed(() => props.mode !== 'authorize' && props.mode !== 'plain')
const showUserMenu = computed(() => props.mode !== 'plain')
</script>
