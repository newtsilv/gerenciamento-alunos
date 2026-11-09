"use client";

import { Stagger, StaggerItem } from "@/components/shared/motion";
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BriefcaseIcon, KeyRoundIcon, PencilIcon, Loader2Icon, MoreHorizontalIcon, PlusIcon, SearchIcon, ShieldIcon, UserCheckIcon, UserXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field } from "@/components/shared/field";
import { StatusBadge } from "@/components/shared/status-badge";
import { toastResult } from "@/components/shared/toast-result";
import { addChallengeMember } from "@/lib/actions/challenges";
import { NativeSelect } from "@/components/shared/native-select";
import { createUser, resetPassword, updateUser, updateUserIdentity } from "@/lib/actions/users";
import { userIdentitySchema, userSchema, type UserIdentityInput, type UserInput } from "@/lib/validation";
import { CHALLENGE_ROLE, type ChallengeRole } from "@/lib/domain/constants";

export type UserRow = {
  id: string;
  full_name: string;
  login: string | null;
  email: string;
  technicalEmail: boolean;
  is_admin: boolean;
  active: boolean;
  roles: { challenge: string; role: ChallengeRole }[];
};

export function UsersTable({ users, viewerId, challenges }: { users: UserRow[]; viewerId: string; challenges: { id: string; name: string }[] }) {
  const [q, setQ] = useState("");
  const [pwdUser, setPwdUser] = useState<UserRow | null>(null);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [roleUser, setRoleUser] = useState<UserRow | null>(null);
  const [, startTransition] = useTransition();
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return users.filter((u) => !s || u.full_name.toLowerCase().includes(s) || u.login?.toLowerCase().includes(s) || u.email.includes(s));
  }, [users, q]);

  return (
    <Stagger className="flex flex-col gap-4">
      <StaggerItem className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <div className="relative sm:w-80">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, RA ou e-mail…" className="pl-9" />
        </div>
        <NewUserDialog />
      </StaggerItem>
      <StaggerItem className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b">
              <th className="px-4 py-3 font-normal">Nome</th>
              <th className="px-4 py-3 font-normal">RA</th>
              <th className="px-4 py-3 font-normal">Vínculos</th>
              <th className="px-4 py-3 font-normal">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((u) => (
              <tr key={u.id} className="align-top odd:bg-surface/50">
                <td className="px-4 py-3">
                  <p className="font-medium">
                    {u.full_name}
                    {u.id === viewerId && <span className="ml-1 text-xs text-muted-foreground">(você)</span>}
                  </p>
                  {!u.technicalEmail && <p className="text-xs text-muted-foreground">{u.email}</p>}
                </td>
                <td className="px-4 py-3 tabular-nums">{u.login ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {u.is_admin && (
                      <StatusBadge tone="info" icon={<ShieldIcon />}>
                        Administrador
                      </StatusBadge>
                    )}
                    {u.roles.map((r, i) => (
                      <StatusBadge key={i}>
                        {CHALLENGE_ROLE[r.role]} · {r.challenge}
                      </StatusBadge>
                    ))}
                    {!u.is_admin && !u.roles.length && <span className="text-xs text-muted-foreground">Sem vínculos</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge tone={u.active ? "success" : "neutral"} dot>
                    {u.active ? "Ativo" : "Inativo"}
                  </StatusBadge>
                </td>
                <td className="px-4 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Ações para ${u.full_name}`} />}>
                      <MoreHorizontalIcon />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={() => setRoleUser(u)}>
                        <BriefcaseIcon /> Dar cargo em desafio
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setEditUser(u)}>
                        <PencilIcon /> Editar nome e RA
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setPwdUser(u)}>
                        <KeyRoundIcon /> Redefinir senha
                      </DropdownMenuItem>
                      {u.id !== viewerId && (
                        <>
                          <DropdownMenuItem onClick={() => startTransition(async () => void toastResult(await updateUser(u.id, { is_admin: !u.is_admin })))}>
                            <ShieldIcon /> {u.is_admin ? "Remover administrador" : "Tornar administrador"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant={u.active ? "destructive" : "default"}
                            onClick={() => startTransition(async () => void toastResult(await updateUser(u.id, { active: !u.active })))}
                          >
                            {u.active ? <UserXIcon /> : <UserCheckIcon />} {u.active ? "Desativar acesso" : "Reativar acesso"}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </StaggerItem>
      {roleUser && <RoleDialog user={roleUser} challenges={challenges} onClose={() => setRoleUser(null)} />}
      {editUser && <EditUserDialog user={editUser} onClose={() => setEditUser(null)} />}
      {pwdUser && <PasswordDialog user={pwdUser} onClose={() => setPwdUser(null)} />}
    </Stagger>
  );
}

function NewUserDialog() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<UserInput>({
    resolver: zodResolver(userSchema),
    defaultValues: { full_name: "", login: "", email: "", password: "", is_admin: false },
  });
  const e = form.formState.errors;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <PlusIcon /> Novo usuário
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
          <DialogDescription>O acesso é feito com nome ou RA e senha. Os papéis (coordenador, professor, monitor) são definidos em cada desafio.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={form.handleSubmit((v) =>
            startTransition(async () => {
              if (toastResult(await createUser(v))) {
                form.reset();
                setOpen(false);
              }
            }),
          )}
        >
          <Field label="Nome completo" required error={e.full_name?.message}>
            <Input {...form.register("full_name")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="RA (opcional)" error={e.login?.message}>
              <Input autoCapitalize="none" {...form.register("login")} />
            </Field>
            <Field label="Senha inicial" required error={e.password?.message}>
              <Input type="password" autoComplete="new-password" {...form.register("password")} />
            </Field>
          </div>
          <Field label="E-mail (opcional)" error={e.email?.message}>
            <Input type="email" {...form.register("email")} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--brand)]" {...form.register("is_admin")} />
            Administrador do sistema
          </label>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2Icon className="animate-spin" />}
            Criar usuário
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PasswordDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [pwd, setPwd] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redefinir senha</DialogTitle>
          <DialogDescription>{user.full_name}</DialogDescription>
        </DialogHeader>
        <Input type="password" autoComplete="new-password" placeholder="Nova senha (mín. 6 caracteres)" value={pwd} onChange={(e) => setPwd(e.target.value)} />
        <Button
          disabled={pending || pwd.length < 6}
          onClick={() =>
            startTransition(async () => {
              if (toastResult(await resetPassword(user.id, pwd))) onClose();
            })
          }
        >
          {pending && <Loader2Icon className="animate-spin" />}
          Salvar nova senha
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const form = useForm<UserIdentityInput>({
    resolver: zodResolver(userIdentitySchema),
    defaultValues: { full_name: user.full_name, login: user.login ?? "" },
  });
  const e = form.formState.errors;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar nome e RA</DialogTitle>
          <DialogDescription>A senha continua a mesma. Sem RA, a pessoa entra pelo nome completo.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={form.handleSubmit((v) =>
            startTransition(async () => {
              if (toastResult(await updateUserIdentity(user.id, v))) onClose();
            }),
          )}
        >
          <Field label="Nome completo" required error={e.full_name?.message}>
            <Input {...form.register("full_name")} />
          </Field>
          <Field label="RA (opcional)" error={e.login?.message}>
            <Input autoCapitalize="none" {...form.register("login")} />
          </Field>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2Icon className="animate-spin" />}
            Salvar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RoleDialog({ user, challenges, onClose }: { user: UserRow; challenges: { id: string; name: string }[]; onClose: () => void }) {
  const [challengeId, setChallengeId] = useState(challenges[0]?.id ?? "");
  const [role, setRole] = useState<ChallengeRole>("monitor");
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dar cargo em desafio</DialogTitle>
          <DialogDescription>{user.full_name}</DialogDescription>
        </DialogHeader>
        {challenges.length === 0 ? (
          <p className="text-sm text-muted-foreground">Crie um desafio primeiro.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <Field label="Desafio" required>
              <NativeSelect value={challengeId} onChange={(e) => setChallengeId(e.target.value)}>
                {challenges.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Cargo" required>
              <NativeSelect value={role} onChange={(e) => setRole(e.target.value as ChallengeRole)}>
                {(Object.keys(CHALLENGE_ROLE) as ChallengeRole[]).map((r) => (
                  <option key={r} value={r}>
                    {CHALLENGE_ROLE[r]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Button
              disabled={pending || !challengeId}
              onClick={() =>
                startTransition(async () => {
                  if (toastResult(await addChallengeMember({ challenge_id: challengeId, user_id: user.id, role }))) onClose();
                })
              }
            >
              {pending && <Loader2Icon className="animate-spin" />}
              Salvar cargo
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
