<template>
  <VContainer>
    <VRow>
      <VCol cols="12">
        <VCard>
          <VCardTitle>
            <div class="flex justify-between items-center">
              <div>{{ t('msg.credentials') }}</div>
              <div class="flex gap-2">
                <VMenu>
                  <template v-slot:activator="{ props }">
                    <VBtn :text="t('actions.add-credential')" variant="tonal" v-bind="props" />
                  </template>
                  <VList>
                    <VListItem v-for="type in types" :key="type" :value="type">
                      <VListItemTitle>{{ t(`credentials.${type}`) }}</VListItemTitle>
                      <CredentialBindDialog action="bind" :type="type" @updated="refresh()" />
                    </VListItem>
                  </VList>
                </VMenu>
              </div>
            </div>
          </VCardTitle>
          <VDivider />
          <VCardText>
            <VRow v-if="credentials">
              <VCol v-for="credential in credentials" :key="credential._id" cols="12">
                <CredentialCard :credential="credential" @updated="refresh()" />
              </VCol>
            </VRow>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </VContainer>
</template>

<script setup lang="ts">
definePageMeta({
  level: 1
})

const { t } = useI18n()

const { data: credentials, refresh } = await useAsyncData(async () => {
  const resp = await api.user.credential.$get()
  const { credentials } = await resp.json()
  return credentials
})

const { data: types } = await useAsyncData(async () => {
  const resp = await api.user.credential.bind.$get()
  const { types } = await resp.json()
  return types
})
</script>

<i18n>
zhHans:
  msg:
    credentials: 凭证列表
</i18n>
