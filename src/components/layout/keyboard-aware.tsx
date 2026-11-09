"use client";

import { useEffect } from "react";

/** Abaixo disso é a barra de endereço do navegador mudando de tamanho, não o teclado. */
const MIN_KEYBOARD_HEIGHT = 120;
const MARGIN = 16;
const NON_TEXT_INPUTS = new Set(["checkbox", "radio", "date", "file", "range", "color", "button", "submit"]);

function activeTextField(): HTMLElement | null {
  const el = document.activeElement;
  if (el instanceof HTMLTextAreaElement) return el;
  if (el instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(el.type)) return el;
  return null;
}

/**
 * Mantém visível o que está sendo digitado no celular.
 *
 * O teclado não muda o tamanho da página, só cobre a parte de baixo. A API `visualViewport`
 * informa a área que continua visível; a partir dela o app reserva o espaço do teclado,
 * esconde as barras fixas e rola a tela até o campo.
 */
export function KeyboardAware() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    let frame = 0;

    const syncInset = () => {
      const covered = window.innerHeight - viewport.height;
      const isOpen = viewport.scale <= 1.01 && covered > MIN_KEYBOARD_HEIGHT && !!activeTextField();
      root.style.setProperty("--keyboard-inset", `${isOpen ? Math.round(covered) : 0}px`);
      root.toggleAttribute("data-keyboard-open", isOpen);
      return isOpen;
    };

    const keepFieldVisible = () => {
      const field = activeTextField();
      if (!field) return;
      if (field.closest('[data-slot="dialog-content"]')) {
        field.scrollIntoView({ block: "center" });
        return;
      }
      // cabeçalhos grudados no topo também tapam a tela
      const headerBottom = Math.max(0, ...[...document.querySelectorAll("[data-sticky-top]")].map((h) => h.getBoundingClientRect().bottom));
      const visibleTop = Math.max(headerBottom, viewport.offsetTop) + MARGIN;
      const visibleBottom = viewport.offsetTop + viewport.height - MARGIN;
      const rect = field.getBoundingClientRect();
      // campo maior que a área livre: prioriza o fim, onde o texto está sendo escrito
      if (rect.bottom > visibleBottom) window.scrollBy(0, rect.bottom - visibleBottom);
      else if (rect.top < visibleTop) window.scrollBy(0, rect.top - visibleTop);
    };

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (syncInset()) keepFieldVisible();
      });
    };

    viewport.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("input", update); // o campo cresce conforme se escreve
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("input", update);
    };
  }, []);

  return null;
}
