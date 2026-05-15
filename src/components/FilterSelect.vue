<template>
  <div
    ref="rootRef"
    class="filter-select"
  >
    <button
      class="filter-select__trigger"
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      :aria-expanded="open"
      @click="toggleOpen"
      @keydown="handleTriggerKeydown"
    >
      <span class="filter-select__summary">{{ summaryLabel }}</span>
      <span
        class="filter-select__caret"
        aria-hidden="true"
      />
    </button>

    <div
      ref="dropdownRef"
      v-show="open || options.length === 0"
      class="filter-select__dropdown"
      role="listbox"
      :style="dropdownStyle"
    >
      <div
        v-if="options.length"
        class="filter-select__options"
      >
        <button
          v-for="(option, index) in options"
          :key="option.value"
          :class="[
            'filter-select__option',
            { 'filter-select__option--selected': option.value === modelValue },
            { 'filter-select__option--highlighted': index === highlightedIndex },
          ]"
          type="button"
          role="option"
          :aria-selected="option.value === modelValue"
          @click="selectOption(option.value)"
          @mouseenter="highlightedIndex = index"
        >
          <span
            :ref="(element) => setOptionLabelRef(option.value, element as Element | null)"
            class="filter-select__option-label"
            :title="resolveTruncatedTitle(option.label, truncatedOptionValues[option.value])"
          >{{ option.label }}</span>
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { t } from '@/i18n/ui'

import { buildDropdownLayout, buildTruncationMap, resolveTruncatedTitle } from './dropdown-option-truncation'

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
const dropdownRef = ref<HTMLElement | null>(null)
const highlightedIndex = ref(-1)
const optionLabelRefs = new Map<string, HTMLElement>()
const truncatedOptionValues = ref<Record<string, boolean>>({})
const dropdownMaxWidth = ref('min(28rem, calc(100vw - 32px))')
const dropdownOffsetX = ref('0px')
const resolvedEmptyLabel = computed(() => props.emptyLabel ?? t('shared.noOptionsAvailable'))
const dropdownStyle = computed(() => ({
  maxWidth: dropdownMaxWidth.value,
  transform: `translateX(${dropdownOffsetX.value})`,
}))

const summaryLabel = computed(() => {
  return props.options.find(option => option.value === props.modelValue)?.label
    ?? props.options[0]?.label
    ?? resolvedEmptyLabel.value
})

watch(open, (isOpen) => {
  if (isOpen) {
    const selectedIdx = props.options.findIndex(o => o.value === props.modelValue)
    highlightedIndex.value = selectedIdx >= 0 ? selectedIdx : 0
    void measureOptionLabelsAfterRender()
  } else {
    highlightedIndex.value = -1
  }
})

watch(() => props.options, () => {
  if (!open.value) {
    return
  }

  void measureOptionLabelsAfterRender()
}, { deep: true })

function toggleOpen() {
  open.value = !open.value
}

function selectOption(value: string) {
  emit('update:modelValue', value)
  open.value = false
}

function setOptionLabelRef(optionValue: string, element: Element | null) {
  if (element instanceof HTMLElement) {
    optionLabelRefs.set(optionValue, element)
    return
  }

  optionLabelRefs.delete(optionValue)
}

function measureOptionLabels() {
  const dropdownRect = dropdownRef.value?.getBoundingClientRect()

  truncatedOptionValues.value = buildTruncationMap(
    [...optionLabelRefs.entries()].map(([key, element]) => ({
      key,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      clippedLeft: Boolean(dropdownRect && element.getBoundingClientRect().left < dropdownRect.left),
      clippedRight: Boolean(dropdownRect && element.getBoundingClientRect().right > dropdownRect.right),
    })),
  )
}

function updateDropdownLayout() {
  if (!rootRef.value || !dropdownRef.value) {
    return
  }

  const rootRect = rootRef.value.getBoundingClientRect()
  const dropdownRect = dropdownRef.value.getBoundingClientRect()
  const container = rootRef.value.closest('.reference-analytics') ?? rootRef.value.closest('.reference-analytics-root') ?? rootRef.value.parentElement
  const containerRect = container?.getBoundingClientRect() ?? rootRect

  const layout = buildDropdownLayout({
    triggerLeft: rootRect.left,
    triggerWidth: rootRect.width,
    contentWidth: dropdownRect.width,
    containerLeft: containerRect.left,
    containerWidth: containerRect.width,
    viewportWidth: window.innerWidth,
    viewportPadding: 16,
    designMaxWidth: 448,
  })

  dropdownMaxWidth.value = layout.maxWidth
  dropdownOffsetX.value = layout.offsetX
}

async function measureOptionLabelsAfterRender() {
  await nextTick()
  updateDropdownLayout()
  await nextTick()
  measureOptionLabels()
}

function handleWindowResize() {
  if (!open.value) {
    return
  }

  void measureOptionLabelsAfterRender()
}

function handleTriggerKeydown(event: KeyboardEvent) {
  const { key } = event

  if (!open.value) {
    if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ') {
      event.preventDefault()
      open.value = true
    }
    return
  }

  if (key === 'ArrowDown') {
    event.preventDefault()
    highlightedIndex.value = Math.min(props.options.length - 1, highlightedIndex.value + 1)
  } else if (key === 'ArrowUp') {
    event.preventDefault()
    highlightedIndex.value = Math.max(0, highlightedIndex.value - 1)
  } else if (key === 'Enter' || key === ' ') {
    event.preventDefault()
    const option = props.options[highlightedIndex.value]
    if (option) {
      selectOption(option.value)
    }
  } else if (key === 'Escape') {
    event.preventDefault()
    open.value = false
  }
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
  window.addEventListener('resize', handleWindowResize)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  window.removeEventListener('resize', handleWindowResize)
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
  min-width: 100%;
  width: max-content;
  z-index: var(--z-dropdown, 10);
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
  width: max-content;
  min-width: 100%;
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
  white-space: nowrap;
  min-width: 0;
}

.filter-select__option-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.filter-select__option:hover,
.filter-select__option--highlighted {
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
