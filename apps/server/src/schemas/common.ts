import * as z from "zod";

// Shared error response schemas used by API docs and route contracts.
export const Error400Schema = z.object({
  error: z.string().describe("描述校验失败原因的错误消息"),
  details: z
    .any()
    .optional()
    .describe("附加错误详情，例如 Zod issue 列表"),
});

export const Error401Schema = z.object({
  error: z.string().describe("未授权"),
});

export const Error403Schema = z.object({
  error: z.string().describe("操作被禁止的原因"),
});

export const Error404Schema = z.object({
  error: z.string().describe("未找到地图等类似错误消息"),
});

export const Error409Schema = z.object({
  error: z.string().describe("冲突原因"),
});

export const Error500Schema = z.object({
  error: z.string().describe("内部错误消息"),
});

export const PaginatedQuerySchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(1)
    .describe("页码，从 1 开始"),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe("每页条目数，最大 50"),
});

export function paginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema).describe("当前页条目数组"),
    total: z.number().int().describe("所有分页中的条目总数"),
  });
}
