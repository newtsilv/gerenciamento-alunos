"use client";

import { UsersRoundIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MembersManager, type MembersManagerProps } from "./members-manager";

/** Atalho para vincular monitores/coordenadores sem sair da tela de equipes. */
export function MembersDialog(props: MembersManagerProps & { trigger?: React.ReactElement; label?: string }) {
  const { trigger, label = "Monitores e coordenadores", ...manager } = props;
  return (
    <Dialog>
      <DialogTrigger render={trigger ?? <Button variant="outline" />}>
        <UsersRoundIcon /> {label}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Monitores e coordenadores</DialogTitle>
          <DialogDescription>
            Escolha a pessoa e o cargo e clique em Vincular. Quem é monitor aparece na escolha do monitor de cada equipe.
          </DialogDescription>
        </DialogHeader>
        <MembersManager {...manager} />
      </DialogContent>
    </Dialog>
  );
}
