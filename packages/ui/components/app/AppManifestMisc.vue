<template>
  <VCard flat>
    <VCardText>
      <template v-if="manifest.openid">
        <VCheckbox v-model="manifest.openid.allowPublicClient" label="Allow public client" />
        <VCheckbox v-model="manifest.openid.defaultPublicClient" label="Default public client" />
        <VTextField
          v-model.number="manifest.openid.minSecurityLevel"
          label="Minimal security level"
        />
        <CommonDictEditor
          v-if="manifest.openid.additionalClaims"
          v-model="manifest.openid.additionalClaims"
          label="Additional Claims"
          :factory="() => ''"
        >
          <template #item="scoped">
            <VTextField v-bind="scoped" label="Value" />
          </template>
        </CommonDictEditor>
        <CommonListEditor
          v-if="manifest.openid.logoutUrls"
          v-model="manifest.openid.logoutUrls"
          label="OIDC Logout URLs"
          :factory="() => ''"
        >
          <template #item="scoped">
            <VTextField v-bind="scoped" label="Logout URL" />
          </template>
        </CommonListEditor>
      </template>
    </VCardText>
  </VCard>
</template>

<script setup lang="ts">
import type { IAppManifest } from '@uaaa/server'

const manifest = defineModel<IAppManifest>({ required: true })
manifest.value.openid ??= {}
manifest.value.openid.additionalClaims ??= {}
manifest.value.openid.logoutUrls ??= []
</script>
