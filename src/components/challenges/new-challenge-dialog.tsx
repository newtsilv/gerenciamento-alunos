"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ChallengeForm } from "./challenge-form";

export function NewChallengeDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <PlusIcon />
        Novo desafio
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo desafio</DialogTitle>
          <DialogDescription>Os critérios de avaliação padrão e as sessões de acompanhamento são criados automaticamente.</DialogDescription>
        </DialogHeader>
        <ChallengeForm onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
