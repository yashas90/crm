export const FLAT_LIST_PERF = {
  windowSize: 5,
  maxToRenderPerBatch: 10,
  initialNumToRender: 10,
  // Android: true can blank the list / clip ListEmptyComponent.
  removeClippedSubviews: false,
} as const;

/** Approximate lead list row height for getItemLayout (optional; prefer omit on Android). */
export const LEAD_ROW_HEIGHT = 108;
