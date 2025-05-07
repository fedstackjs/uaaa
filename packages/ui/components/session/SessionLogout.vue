<template>
  <VSkeletonLoader v-if="status === 'pending'" type="card" />
  <template v-else>
    <VCardText>
      <VAlert :type :text />
    </VCardText>
    <VCardActions class="grid! grid-flow-col grid-auto-cols-[1fr]">
      <VBtn
        variant="tonal"
        color="error"
        :text="t('actions.logout')"
        :loading="logoutRunning"
        :disabled="cancelRunning"
        @click="logout"
      />
      <VBtn
        variant="tonal"
        color="primary"
        :text="t('actions.cancel')"
        :loading="cancelRunning"
        :disabled="logoutRunning"
        @click="cancel"
      />
    </VCardActions>
  </template>
</template>

<script setup lang="ts">
const { params } = defineProps<{
  params: ILogoutParams
}>()

const { t } = useI18n()
const router = useRouter()

const { data, status } = await useAsyncData(async () => {
  return params.connector.preLogout(params)
})

const type = computed(() => (data.value?.trusted ? 'info' : 'warning'))
const text = computed(() => {
  if (data.value?.app) {
    if (data.value.trusted) {
      return t('msg.logout_hint', { name: data.value.app.name })
    }
    return t('msg.logout_hint_untrusted', { name: data.value.app.name })
  }
  return t('msg.logout_hint_generic')
})

const { run: logout, running: logoutRunning } = useTask(async () => {
  if (!data.value) return
  await params.connector.onLogout(data.value, params)
  return symNoToast
})

const { run: cancel, running: cancelRunning } = useTask(async () => {
  if (!data.value) return
  await params.connector.onCancel(data.value, params)
  router.replace('/')
  return symNoToast
})
</script>

<i18n>
zh-Hans:
  msg:
    logout_hint: 您已成功登出{name}。点按确定将使您也退出UAAA身份认证系统。
    logout_hint_untrusted: 您似乎刚刚登出了{name}。点按确定将使您退出UAAA身份认证系统。
    logout_hint_generic: 您正在执行登出操作。点按确定将使您退出UAAA身份认证系统。
en:
  msg:
    logout_hint: You have successfully logged out of {name}. Press OK to log out of UAAA.
    logout_hint_untrusted: You seem to have just logged out of {name}. Press OK to log out of UAAA.
    logout_hint_generic: You are performing a logout operation. Press OK to log out of UAAA.
</i18n>
