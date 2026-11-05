"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const KEY = "acompanha:nav";
const MAX = 50;

function read(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function write(stack: string[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(stack.slice(-MAX)));
  } catch {
    /* armazenamento indisponível: o "Voltar" usa o destino padrão */
  }
}

/**
 * Registra as telas visitadas nesta aba (apenas o caminho, sem filtros da URL).
 * Voltar para a tela anterior remove a atual da pilha, espelhando o histórico do navegador.
 */
export function NavigationHistory() {
  const pathname = usePathname();
  useEffect(() => {
    const stack = read();
    const top = stack[stack.length - 1];
    if (top === pathname) return;
    if (stack[stack.length - 2] === pathname) stack.pop();
    else stack.push(pathname);
    write(stack);
  }, [pathname]);
  return null;
}

/** Existe uma tela anterior dentro do app nesta aba? */
export function hasPreviousScreen(): boolean {
  return read().length >= 2;
}
