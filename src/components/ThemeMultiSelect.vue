<template>
  <div
    ref="rootRef"
    class="theme-multi-select"
  >
    <button
      class="theme-multi-select__trigger"
      type="button"
      :aria-expanded="open"
      @click="toggleOpen"
    >
      <span class="theme-multi-select__summary">{{ summaryLabel }}</span>
      <span
        class="theme-multi-select__caret"
        aria-hidden="true"
      />
    </button>

    <div
      v-show="open || options.length === 0"
      class="theme-multi-select__dropdown"
    >
      <div
        v-if="options.length"
        class="theme-multi-select__actions"
      >
        <button
          class="theme-multi-select__action"
          type="button"
          @click="clearSelection"
        >
          清空
        </button>
      </div>

      <div
        v-if="options.length"
        class="theme-multi-select__options"
      >
        <label
          v-for="option in options"
          :key="option.documentId"
          class="theme-multi-select__option"
        >
          <input
            class="theme-multi-select__checkbox"
            type="checkbox"
            :checked="modelValue.includes(option.value)"
            @change="toggleOption(option.value)"
          >
          <span>{{ option.label }}</span>
        </label>
      </div>

      <div
        v-else
        class="theme-multi-select__empty"
      >
        未配置主题文档
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import type { ThemeOption } from '@/analytics/theme-documents'

const props = defineProps<{
  modelValue: string[]
  options: ThemeOption[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const summaryLabel = computed(() => {
  if (props.options.length === 0) {
    return '未配置主题文档'
  }
  if (props.modelValue.length === 0) {
    return '全部主题'
  }
  return `已选 ${props.modelValue.length} 个主题`
})

function toggleOpen() {
  open.value = !open.value
}

function toggleOption(value: string) {
  if (props.modelValue.includes(value)) {
    emit('update:modelValue', props.modelValue.filter(item => item !== value))
    return
  }
  emit('update:modelValue', [...props.modelValue, value])
}

function clearSelection() {
  emit('update:modelValue', [])
}

function onDocumentClick(event: MouseEvent) {
  if (!rootRef.value) {
    return
  }
  const target = event.target
  if (target instanceof Node && !rootRef.value.contains(target)) {
    open.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
})
</script>

<style scoped>
.theme-multi-select {
  position: relative;
}

.theme-multi-select__trigger {
  width: 100%;
  min-height: 20px;
  border: 0;
  border-radius: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.theme-multi-select__summary {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}

.theme-multi-select__caret {
  width: 7px;
  height: 7px;
  flex: none;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(45deg);
}

.theme-multi-select__dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  z-index: 10;
  border: 1px solid var(--panel-border);
  border-radius: 12px;
  background: var(--surface-card-strong);
  box-shadow: 0 12px 24px -12px rgba(0, 0, 0, 0.24);
  overflow: hidden;
}

.theme-multi-select__actions {
  display: flex;
  justify-content: flex-end;
  padding: 10px 12px 0;
}

.theme-multi-select__action {
  border: 0;
  background: transparent;
  color: var(--b3-theme-primary);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}

.theme-multi-select__options {
  display: grid;
  gap: 2px;
  max-height: 220px;
  overflow: auto;
  padding: 8px;
}

.theme-multi-select__option {
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.theme-multi-select__option:hover {
  background: var(--surface-card-soft);
}

.theme-multi-select__checkbox {
  margin: 0;
}

.theme-multi-select__empty {
  padding: 14px 12px;
  color: var(--panel-muted);
  font-size: 13px;
}
</style>
