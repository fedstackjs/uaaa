<template>
  <div>
    <div class="flex justify-between items-center py-2">
      <div>{{ label }}</div>
      <VBtn
        prepend-icon="mdi-plus"
        variant="outlined"
        :text="t('actions.add')"
        @click="model.push(factory())"
      />
    </div>
    <div v-for="(value, index) in model" :key="index" class="flex justify-between items-start pb-2">
      <div class="flex-1">
        <slot
          name="item"
          :modelValue="value"
          @update:modelValue="($event: T) => (model[index] = $event)"
        />
      </div>
      <VBtn icon="mdi-delete" variant="text" @click="model.splice(index, 1)" />
    </div>
  </div>
</template>

<script setup lang="ts" generic="T">
const model = defineModel<T[]>({ required: true })
defineProps<{
  label: string
  factory: () => T
}>()

const { t } = useI18n()
</script>
