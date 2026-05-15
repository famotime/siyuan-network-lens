export type DropdownOptionMeasurement = {
  key: string
  clientWidth: number
  scrollWidth: number
  clippedLeft?: boolean
  clippedRight?: boolean
}

export type DropdownLayoutParams = {
  triggerLeft: number
  triggerWidth: number
  contentWidth: number
  containerLeft: number
  containerWidth: number
  viewportWidth: number
  viewportPadding: number
  designMaxWidth: number
}

export type DropdownLayout = {
  maxWidth: string
  offsetX: string
}

export function buildTruncationMap(measurements: readonly DropdownOptionMeasurement[]): Record<string, boolean> {
  return Object.fromEntries(
    measurements.map(measurement => [
      measurement.key,
      measurement.scrollWidth > measurement.clientWidth || Boolean(measurement.clippedLeft) || Boolean(measurement.clippedRight),
    ]),
  )
}

export function resolveTruncatedTitle(label: string, truncated?: boolean): string | undefined {
  return truncated ? label : undefined
}

function resolveDropdownBounds(params: DropdownLayoutParams) {
  const containerRight = params.containerLeft + params.containerWidth
  const viewportLeft = params.viewportPadding
  const viewportRight = params.viewportWidth - params.viewportPadding

  return {
    left: Math.max(params.containerLeft, viewportLeft),
    right: Math.max(0, Math.min(containerRight, viewportRight)),
  }
}

export function buildDropdownMaxWidth(params: DropdownLayoutParams): string {
  const bounds = resolveDropdownBounds(params)
  const availableWidth = Math.max(0, bounds.right - bounds.left)

  return `${Math.max(0, Math.min(params.designMaxWidth, availableWidth))}px`
}

export function buildDropdownLayout(params: DropdownLayoutParams): DropdownLayout {
  const bounds = resolveDropdownBounds(params)
  const maxWidthPx = Number.parseFloat(buildDropdownMaxWidth(params)) || 0
  const desiredWidth = Math.max(
    params.triggerWidth,
    Math.min(params.contentWidth, maxWidthPx),
  )
  const overflowRight = Math.max(0, params.triggerLeft + desiredWidth - bounds.right)
  const maxShiftLeft = Math.max(0, params.triggerLeft - bounds.left)
  const shiftLeft = Math.min(overflowRight, maxShiftLeft)

  return {
    maxWidth: `${maxWidthPx}px`,
    offsetX: `${-shiftLeft}px`,
  }
}
