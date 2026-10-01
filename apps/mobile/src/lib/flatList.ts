export const FLAT_LIST_PERF = {
  windowSize: 5,
  maxToRenderPerBatch: 10,
  initialNumToRender: 8,
  updateCellsBatchingPeriod: 50,
  // Android: true can blank the list / clip ListEmptyComponent.
  removeClippedSubviews: false,
  onEndReachedThreshold: 0.5,
} as const;

/** Approximate lead list row height for getItemLayout (optional; prefer omit on Android). */
export const LEAD_ROW_HEIGHT = 108;

export function getFixedItemLayout(itemHeight: number) {
  return (_data: unknown, index: number) => ({
    length: itemHeight,
    offset: itemHeight * index,
    index,
  });
}
