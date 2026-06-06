import * as z from "zod";

// Shared error response schemas used by API docs and route contracts.
export const Error400Schema = z.object({
  error: z.string().describe("Error message describing the validation failure"),
  details: z
    .any()
    .optional()
    .describe("Additional error details (e.g. Zod issues)"),
});

export const Error401Schema = z.object({
  error: z.string().describe('"Unauthorized"'),
});

export const Error403Schema = z.object({
  error: z.string().describe("Reason the action is forbidden"),
});

export const Error404Schema = z.object({
  error: z.string().describe('"Map not found" or similar'),
});

export const Error409Schema = z.object({
  error: z.string().describe("Conflict reason"),
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
    .describe("Page number, starting from 1"),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe("Items per page, max 50"),
});

export function paginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema).describe("Array of items in the current page"),
    total: z.number().int().describe("Total number of items across all pages"),
  });
}
