"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/shared/native-select";
import { toastResult } from "@/components/shared/toast-result";
import { addPedagogicalNote, deletePedagogicalNote } from "@/lib/actions/notes";
import { formatDateTime } from "@/lib/domain/dates";

type Note = { id: string; content: string; created_at: string; author_id: string; authorName: string; studentName: string | null };

export function NotesPanel({
  challengeId,
  teamId,
  notes,
  students,
  viewerId,
}: {
  challengeId: string;
  teamId: string;
  notes: Note[];
  students: { id: string; name: string }[];
  viewerId: string;
}) {
  const [content, setContent] = useState("");
  const [studentId, setStudentId] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Textarea rows={3} placeholder="Registrar observação pedagógica…" value={content} onChange={(e) => setContent(e.target.value)} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <NativeSelect value={studentId} onChange={(e) => setStudentId(e.target.value)} wrapperClassName="flex-1" aria-label="Aluno">
            <option value="">Sobre a equipe</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                Sobre {s.name}
              </option>
            ))}
          </NativeSelect>
          <Button
            disabled={!content.trim() || pending}
            onClick={() =>
              startTransition(async () => {
                if (toastResult(await addPedagogicalNote(challengeId, teamId, content, studentId || null))) {
                  setContent("");
                  setStudentId("");
                }
              })
            }
          >
            {pending && <Loader2Icon className="animate-spin" />}
            Registrar
          </Button>
        </div>
      </div>
      {notes.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">Nenhuma observação registrada.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-xl border p-3">
              <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  <strong className="font-medium text-foreground">{n.authorName}</strong>
                  {n.studentName && ` · sobre ${n.studentName}`} · {formatDateTime(n.created_at)}
                </span>
                {n.author_id === viewerId && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Excluir observação"
                    onClick={() => startTransition(async () => void toastResult(await deletePedagogicalNote(challengeId, teamId, n.id)))}
                  >
                    <Trash2Icon />
                  </Button>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap">{n.content}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
