<template>
  <VTooltip :text="data?.name">
    <template v-slot:activator="{ props }">
      <VAvatar
        rounded
        v-bind="{ ...$attrs, ...props }"
        :color="data?.icon ? undefined : stringToColor(appId)"
      >
        <template v-if="data">
          <VImg v-if="data.icon" :src="data.icon" />
          <span
            v-else
            class="text-h5"
            :style="{ color: contrastingColor(stringToColor(appId)) }"
            v-text="generateTitle(data.name)"
          />
        </template>
      </VAvatar>
    </template>
  </VTooltip>
</template>

<script setup lang="ts">
import uaaa from '@/public/logo.svg'

const props = defineProps<{
  appId: string
  icon?: string
  name?: string
}>()

const { data } = await useAsyncData(props.appId, async () => {
  if (props.appId === api.appId.value) return { name: 'UAAA', icon: uaaa }
  if (props.icon) return { icon: props.icon, name: props.name ?? '' }
  if (props.name) return { name: props.name }
  const resp = await api.public.app[':id'].$get({ param: { id: props.appId } })
  await api.checkResponse(resp)
  const { app } = await resp.json()
  return app
})

const generateTitle = (name: string) => {
  const [first, second] = name.split(/\s+/)
  const code = (first[0] + (second ? second[0] : (first[1] ?? ''))).toUpperCase()
  if (/[^\x01-\x7E]/.test(code)) return code[0]
  return code
}
</script>
