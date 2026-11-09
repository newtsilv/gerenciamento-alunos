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
 * O teclado só cobre a parte de baixo da página, e o navegador já consegue deslocar a área
 * visível até o campo. Por isso a página não ganha altura nenhuma: aqui só se esconde as
 * barras fixas e se avisa o navegador de que os cabeçalhos grudados também tapam a tela.
 */
export function KeyboardAware() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    let frame = 0;

    const sync = () => {
      const covered = window.innerHeight - viewport.height;
      const field = activeTextField();
      const isOpen = viewport.scale <= 1.01 && covered > MIN_KEYBOARD_HEIGHT && !!field;
      root.style.setProperty("--keyboard-inset", `${isOpen ? Math.round(covered) : 0}px`);
      root.toggleAttribute("data-keyboard-open", isOpen);
      if (!isOpen || !field) {
        root.style.scrollPadding = "";
        return;
      }
      const headerBottom = Math.max(0, ...[...document.querySelectorAll("[data-sticky-top]")].map((h) => h.getBoundingClientRect().bottom));
      root.style.scrollPadding = `${Math.round(headerBottom) + MARGIN}px 0 ${MARGIN}px`;
      field.scrollIntoView({ block: "nearest" });
    };

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    };

    viewport.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
    };
  }, []);

  return null;
}
