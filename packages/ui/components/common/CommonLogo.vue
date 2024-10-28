<template>
  <VImg v-bind="$attrs" :src="variant === 'flat' ? flat : logo" alt="UAAA Logo" />
</template>

<script setup lang="ts">
import logo from '@/public/logo.svg'
import flat from '@/public/logo.svg'

defineProps<{
  variant?: 'flat' | 'default'
}>()
</script>
