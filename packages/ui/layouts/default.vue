<template>
  <VApp>
    <UiAppBar v-model="navOpen" />
    <UiAppNav v-model="navOpen" />
    <VMain>
      <slot />
    </VMain>
  </VApp>
</template>

<script setup lang="ts">
const navOpen = ref()
</script>
