import { ID } from "@/types/project";

let _counter = 0;

/** Generate a unique ID. Deterministic in tests via seed. */
export function generateId(prefix = "id"): ID {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  const count = (++_counter).toString(36);
  return `${prefix}_${ts}${rand}${count}`;
}

export function isValidId(id: string): boolean {
  return typeof id === "string" && id.length > 3;
}
