<template>
  <div class="flex">
    <div class="flex-1">
      <VCardSubtitle class="text-center">{{ t('msg.permissions') }}</VCardSubtitle>
      <div class="px-4">
        <div v-for="(permission, i) of app.requestedPermissions" :key="'p' + i">
          <VCheckbox
            v-model="permissions[permission.perm]"
            :label="permission.perm"
            :readonly="permission.required || readonly"
            hide-details
            color="primary"
            class="font-mono"
          />
          <div class="px-4">
            <b v-if="permission.required" class="text-red pr-1" v-text="t('msg.required')" />
            <span class="pr-1" v-text="t('msg.will-grant-permission-for')" />
            <b v-text="permission.reason" />
          </div>
          <AppPermissionList :permission="permission.perm" />
        </div>
      </div>
    </div>
    <VDivider vertical />
    <div class="flex-1">
      <VCardSubtitle class="text-center">{{ t('msg.claims') }}</VCardSubtitle>
      <div class="px-4">
        <div v-for="(claim, i) of app.requestedClaims" :key="'c' + i">
          <VCheckbox
            density="compact"
            v-model="claims[claim.name]"
            :append-icon="claim.verified ? 'mdi-shield-check' : undefined"
            :readonly="claim.required || readonly"
            hide-details
            color="primary"
            class="font-mono"
          >
            <template #label>
              <b v-text="t(`claims.${claim.name}`, [], { default: claim.name })" />
            </template>
          </VCheckbox>
          <div class="m-t-[-12px] text-sm">
            <b v-if="claim.required" class="text-red pr-1" v-text="t('msg.required')" />
            <span class="pr-1" v-text="t('msg.will-grant-claim-for')" />
            <b v-text="claim.reason" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { IAppDoc } from '@uaaa/server'

const props = defineProps<{
  app: Pick<IAppDoc, '_id' | 'requestedClaims' | 'requestedPermissions' | 'icon' | 'name'>
  readonly?: boolean
  fillRequired?: boolean
}>()
const { t } = useI18n()

const permissions = defineModel<Record<string, boolean>>('permissions', { default: {} })
const claims = defineModel<Record<string, boolean>>('claims', { default: {} })

const {} = await useAsyncData(async () => {
  try {
    const resp = await api.user.installation[':id'].$get({ param: { id: props.app._id } })
    if (resp.ok) {
      const { installation } = await resp.json()
      console.log(installation)
      permissions.value = Object.fromEntries(installation.grantedPermissions.map((p) => [p, true]))
      claims.value = Object.fromEntries(installation.grantedClaims.map((c) => [c, true]))
    }
  } catch {
    permissions.value = {}
    claims.value = {}
  }
  if (props.fillRequired) {
    for (const permission of props.app.requestedPermissions) {
      if (permission.required) {
        permissions.value[permission.perm] = true
      }
    }
    for (const claim of props.app.requestedClaims) {
      if (claim.required) {
        claims.value[claim.name] = true
      }
    }
  }
})
</script>
