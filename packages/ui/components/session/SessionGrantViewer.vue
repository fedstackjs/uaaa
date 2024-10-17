<template>
  <div class="flex">
    <div class="flex-1">
      <VCardSubtitle class="text-center">{{ t('msg.permissions') }}</VCardSubtitle>
      <div class="px-4">
        <div v-for="(permission, i) of permissions" :key="i">
          <AppPermissionList :permission="permission" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  permissions: string[]
}>()
const { t } = useI18n()
</script>
