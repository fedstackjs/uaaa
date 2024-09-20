<template>
  <VCard flat>
    <VCardText>
      <CommonListEditor
        v-model="manifest.requestedPermissions"
        label="Requested Permissions"
        :factory="newRequestedPermission"
      >
        <template #item="scoped">
          <AppRequestedPermissionInput v-bind="scoped" />
        </template>
      </CommonListEditor>
    </VCardText>
  </VCard>
</template>

<script setup lang="ts">
import type { IAppManifest } from '@uaaa/server'

const manifest = defineModel<IAppManifest>({ required: true })
const newRequestedPermission = () => ({ reason: '', perm: '' })
</script>
