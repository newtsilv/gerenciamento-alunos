"use client";

import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, domAnimation, LazyMotion, m, MotionConfig, type Variants } from "motion/react";
import { cn } from "@/lib/utils";

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

const elements = { div: m.div, li: m.li, section: m.section, article: m.article, header: m.header };
type Tag = keyof typeof elements;

const rise: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.34, ease: EASE_OUT } },
};

/** Carrega só o necessário da Motion e respeita a preferência de movimento reduzido do aparelho. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}

/** Revela os `StaggerItem` internos em sequência quando a tela abre. */
export function Stagger({ children, className, step = 0.045 }: { children: ReactNode; className?: string; step?: number }) {
  return (
    <m.div className={className} initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: step } } }}>
      {children}
    </m.div>
  );
}

export function StaggerItem({
  as = "div",
  children,
  className,
  style,
}: {
  as?: Tag;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const Element = elements[as];
  return (
    <Element className={className} style={style} variants={rise}>
      {children}
    </Element>
  );
}

/** Entrada de um bloco isolado. Com `distance={0}` só esmaece (necessário quando há `position: fixed` dentro). */
export function Reveal({
  as = "div",
  children,
  className,
  distance = 10,
}: {
  as?: Tag;
  children: ReactNode;
  className?: string;
  distance?: number;
}) {
  const Element = elements[as];
  return (
    <Element className={className} initial={{ opacity: 0, y: distance }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.34, ease: EASE_OUT }}>
      {children}
    </Element>
  );
}

/** Abre e fecha um trecho animando a altura. `appear` anima também quando o trecho nasce aberto. */
export function Collapse({ open, children, className, appear }: { open: boolean; children: ReactNode; className?: string; appear?: boolean }) {
  return (
    <AnimatePresence initial={!!appear}>
      {open && (
        <m.div
          key="content"
          className={cn(className)}
          initial={{ height: 0, opacity: 0, overflow: "hidden" }}
          // ao terminar libera o overflow para não cortar o anel de foco dos campos
          animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
          exit={{ height: 0, opacity: 0, overflow: "hidden" }}
          transition={{ duration: 0.26, ease: EASE_OUT }}
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>
  );
}
