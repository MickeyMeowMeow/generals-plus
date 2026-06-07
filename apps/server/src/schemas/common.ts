import * as z from "zod";

// Shared error response schemas used by API docs and route contracts.
export const Error400Schema = z.object({
  error: z.string().describe("Error message describing why validation failed"),
  details: z
    .any()
    .optional()
    .describe("Additional error details such as a list of Zod issues"),
});

export const Error401Schema = z.object({
  error: z.string().describe("Unauthorized"),
});

export const Error403Schema = z.object({
  error: z.string().describe("Reason the operation is forbidden"),
});

export const Error404Schema = z.object({
  error: z.string().describe("Not-found message such as a missing map"),
});

export const Error409Schema = z.object({
  error: z.string().describe("Reason for the conflict"),
});

export const Error500Schema = z.object({
  error: z.string().describe("Internal error message"),
});

export const PaginatedQuerySchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(1)
    .describe("Page number starting from 1"),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe("Items per page, maximum 50"),
});

export function paginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema).describe("Items on the current page"),
    total: z.number().int().describe("Total number of items across all pages"),
  });
}
