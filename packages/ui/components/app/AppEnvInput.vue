<template>
  <VTextField v-model="model.value" label="Value" />
</template>

<script setup lang="ts">
import type { IAppEnv } from '@uaaa/server'

const model = defineModel<IAppEnv>({ required: true })
</script>
