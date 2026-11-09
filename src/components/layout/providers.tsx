"use client";

import { ThemeProvider } from "next-themes";
import { LucideProvider } from "lucide-react";
import { KeyboardAware } from "@/components/layout/keyboard-aware";
import { MotionProvider } from "@/components/shared/motion";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <LucideProvider strokeWidth={1.5}>
        <TooltipProvider>
          <MotionProvider>{children}</MotionProvider>
        </TooltipProvider>
      </LucideProvider>
      <KeyboardAware />
      <Toaster richColors position="top-right" closeButton />
    </ThemeProvider>
  );
}
