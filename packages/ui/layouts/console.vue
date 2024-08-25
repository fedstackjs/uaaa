<template>
  <VApp>
    <UiAppBar v-model="navOpen" console />
    <UiAppNav v-model="navOpen" />
    <VMain>
      <VContainer>
        <slot />
      </VContainer>
    </VMain>
  </VApp>
</template>

<script setup lang="ts">
const navOpen = ref()
</script>
