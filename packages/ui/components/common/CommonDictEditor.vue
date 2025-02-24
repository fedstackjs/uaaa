<template>
  <div>
    <div class="flex justify-between items-center py-2">
      <div>{{ label }}</div>
    </div>
    <div v-for="key in Object.keys(model)" :key="key" class="flex justify-between items-start pb-2">
      <div class="flex-1 flex items-center gap-1">
        <VTextField
          :model-value="key"
          label="Key"
          readonly
          append-inner-icon="mdi-delete"
          @click:append-inner="delete model[key]"
        />
        <slot
          name="item"
          class="flex-1"
          :modelValue="model[key]"
          @update:modelValue="($event: T) => (model[key] = $event)"
        />
      </div>
    </div>
    <div class="flex justify-between items-center py-2">
      <VTextField
        v-model="newKey"
        label="New Key"
        append-icon="mdi-plus"
        @click:append="model[newKey] = factory()"
      />
    </div>
  </div>
</template>

<script setup lang="ts" generic="T">
const model = defineModel<Record<string, T>>({ required: true })
defineProps<{
  label: string
  factory: () => T
}>()

const { t } = useI18n()
const newKey = ref('')
</script>
