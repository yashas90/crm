/** Pages with inline error UI should not also show global error toasts. */
export const SILENT_QUERY_ERROR_META = { suppressErrorToast: true } as const;
