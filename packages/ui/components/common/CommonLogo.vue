<template>
  <VImg :src="variant === 'flat' ? flat : logo" alt="Logo" />
</template>

<script setup lang="ts">
import logo from '@/assets/uaaa.svg'
import flat from '@/assets/uaaa_flat.svg'

defineProps<{
  variant?: 'flat' | 'default'
}>()
</script>
