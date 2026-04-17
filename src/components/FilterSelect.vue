<template>
  <div
    ref="rootRef"
    class="filter-select"
  >
    <button
      class="filter-select__trigger"
      type="button"
      :aria-expanded="open"
      @click="toggleOpen"
    >
      <span class="filter-select__summary">{{ summaryLabel }}</span>
      <span
        class="filter-select__caret"
        aria-hidden="true"
      />
    </button>

    <div
      v-show="open || options.length === 0"
      class="filter-select__dropdown"
    >
      <div
        v-if="options.length"
        class="filter-select__options"
      >
        <button
          v-for="option in options"
          :key="option.value"
          :class="['filter-select__option', { 'filter-select__option--selected': option.value === modelValue }]"
          type="button"
          @click="selectOption(option.value)"
        >
          <span>{{ option.label }}</span>
          <span
            v-if="option.value === modelValue"
            class="filter-select__check"
            aria-hidden="true"
          />
        </button>
      </div>

      <div
        v-else
        class="filter-select__empty"
      >
        {{ resolvedEmptyLabel }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { t } from '@/i18n/ui'

type FilterSelectOption = {
  value: string
  label: string
}

const props = withDefaults(defineProps<{
  modelValue: string
  options: FilterSelectOption[]
  emptyLabel?: string
}>(), {
  emptyLabel: undefined,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const resolvedEmptyLabel = computed(() => props.emptyLabel ?? t('shared.noOptionsAvailable'))

const summaryLabel = computed(() => {
  return props.options.find(option => option.value === props.modelValue)?.label
    ?? props.options[0]?.label
    ?? resolvedEmptyLabel.value
})

function toggleOpen() {
  open.value = !open.value
}

function selectOption(value: string) {
  emit('update:modelValue', value)
  open.value = false
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
.filter-select {
  position: relative;
}

.filter-select__trigger {
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
  transition: color 0.2s;
}

.filter-select__trigger:hover,
.filter-select__trigger[aria-expanded='true'] {
  color: var(--b3-theme-primary);
}

.filter-select__summary {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}

.filter-select__caret {
  width: 7px;
  height: 7px;
  flex: none;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(45deg);
  transition: transform 0.2s ease;
}

.filter-select__trigger[aria-expanded='true'] .filter-select__caret {
  transform: rotate(225deg);
}

.filter-select__dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  z-index: 10;
  border: 1px solid color-mix(in srgb, var(--b3-theme-primary) 14%, var(--panel-border));
  border-radius: 14px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--b3-theme-primary) 6%, transparent), transparent 44%),
    var(--surface-card-strong);
  box-shadow:
    0 18px 36px -18px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 color-mix(in srgb, var(--b3-theme-background) 52%, transparent);
  overflow: hidden;
  backdrop-filter: blur(12px);
}

.filter-select__options {
  display: grid;
  gap: 2px;
  max-height: 220px;
  overflow: auto;
  padding: 8px;
}

.filter-select__option {
  border: 1px solid transparent;
  border-radius: 10px;
  padding: 9px 10px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  transition: background-color 0.2s, border-color 0.2s;
}

.filter-select__option:hover {
  background: var(--surface-card-soft);
}

.filter-select__option--selected {
  background: color-mix(in srgb, var(--b3-theme-primary) 10%, var(--surface-card-soft));
  border-color: color-mix(in srgb, var(--b3-theme-primary) 22%, transparent);
}

.filter-select__check {
  width: 8px;
  height: 4px;
  border-left: 2px solid var(--b3-theme-primary);
  border-bottom: 2px solid var(--b3-theme-primary);
  transform: rotate(-45deg);
  flex: none;
}

.filter-select__empty {
  padding: 14px 12px;
  color: var(--panel-muted);
  font-size: 13px;
}
</style>
