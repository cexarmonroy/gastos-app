import type { ZodSchema } from "zod";

export function parseInput<T>(schema: ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(issue?.message ?? "Datos de entrada inválidos.");
  }

  return result.data;
}
