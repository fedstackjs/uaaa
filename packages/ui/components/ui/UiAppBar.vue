<template>
  <VAppBar border>
    <VAppBarNavIcon @click="model = !model" />
    <VToolbarItems>
      <VBtn to="/" rounded="lg" :active="false">
        <template #prepend>
          <VIcon size="42">
            <img :src="uaaa" alt="UAAA" />
          </VIcon>
        </template>
        <div v-if="mdAndUp" class="text-none pl-4 font-mono text-3xl">
          {{ config.public.appName }}
        </div>
      </VBtn>
    </VToolbarItems>

    <VSpacer></VSpacer>

    <UiUserMenu />
  </VAppBar>
</template>

<script setup lang="ts">
import { useDisplay } from 'vuetify'
import uaaa from '@/assets/uaaa.svg'

const model = defineModel<boolean>()
defineProps<{
  console?: boolean
}>()

const config = useRuntimeConfig()
const { t } = useI18n()
const { mdAndUp } = useDisplay()
</script>
