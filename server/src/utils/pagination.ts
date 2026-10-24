const DEFAULT_PAGE_SIZE = 200
const MAX_PAGE_SIZE = 200

export interface PaginationInput {
  page: number
  pageSize: number
}

export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export function resolvePagination(input: { page?: number; pageSize?: number }): PaginationInput {
  const page = Math.max(1, Math.floor(input.page ?? 1))
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(input.pageSize ?? DEFAULT_PAGE_SIZE)))
  return { page, pageSize }
}

export function buildPaginationMeta(
  total: number,
  { page, pageSize }: PaginationInput,
): PaginationMeta {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}
