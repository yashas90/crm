export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
};

export type ApiSuccessResponse<T> = {
  ok: true;
  data: T;
  meta?: PaginationMeta;
};

export type ApiErrorResponse = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export function isApiSuccess<T>(response: ApiResponse<T>): response is ApiSuccessResponse<T> {
  return response.ok;
}

export function isApiError<T>(response: ApiResponse<T>): response is ApiErrorResponse {
  return !response.ok;
}
