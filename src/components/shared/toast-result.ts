"use client";

import { toast } from "sonner";
import type { ActionResult } from "@/lib/actions/result";

/** Exibe feedback padronizado de uma Server Action. Retorna true em caso de sucesso. */
export function toastResult<T>(result: ActionResult<T>, successMessage?: string): result is { ok: true; data: T } {
  if (result.ok) {
    toast.success(result.message ?? successMessage ?? "Operação realizada com sucesso.");
    return true;
  }
  toast.error(result.error);
  return false;
}
