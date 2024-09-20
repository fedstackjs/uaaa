<template>
  <VCard flat>
    <VCardText>
      <CommonListEditor
        v-model="manifest.providedPermissions"
        label="Provided Permissions"
        :factory="newProvidedPermission"
      >
        <template #item="scoped">
          <AppProvidedPermissionInput v-bind="scoped" />
        </template>
      </CommonListEditor>
    </VCardText>
  </VCard>
</template>

<script setup lang="ts">
import type { IAppManifest } from '@uaaa/server'

const manifest = defineModel<IAppManifest>({ required: true })
const newProvidedPermission = () => ({ name: '', description: '', path: '' })
</script>
