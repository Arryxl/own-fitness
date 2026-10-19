"use client";

import { FileJson, FileSpreadsheet, Loader2, LogOut, Pencil, ShieldCheck, Trash2, Upload, UserCog } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { authedFetch, useAuth } from "@/components/providers/AuthProvider";
import { useData } from "@/components/providers/DataProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Button, Card, CardHeader, Field, Input, LinkButton, PageHeader, Segmented, Select, Sheet, Toggle, parseNum } from "@/components/ui";
import { backupToCsv, download, exportAll, importBackup, parseBackup, type Backup } from "@/lib/backup";
import { patchProfile } from "@/lib/db/write";
import { AI_TIER } from "@/lib/hooks/useAi";
import { THEME_KEY, applyTheme, readTheme, type Theme } from "@/lib/theme";
import { GOAL_LABEL, LEVEL_LABEL } from "@/lib/format";

export default function SettingsPage() {
  const data = useData();
  const { user, signOut, isAdmin } = useAuth();
  const toast = useToast();
  const p = data.profile;
  const [form, setForm] = useState({
    stepsTarget: String(p?.stepsTarget ?? 8000),
    rest: String(p?.restTimerDefaultSec ?? 90),
  });
  const [theme, setTheme] = useState<Theme>(() => readTheme());
  const [pendingImport, setPendingImport] = useState<Backup | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function doExport(kind: "json" | "csv") {
    setBusy(true);
    try {
      const b = await exportAll(data.uid);
      const stamp = new Date().toISOString().slice(0, 10);
      if (kind === "json") download(`ironlog-respaldo-${stamp}.json`, JSON.stringify(b, null, 2), "application/json");
      else for (const [name, csv] of Object.entries(backupToCsv(b, data.exerciseMap))) download(`ironlog-${stamp}-${name}`, csv, "text/csv;charset=utf-8");
    } catch {
      toast("No se pudo exportar. Revisa tu conexión e intenta de nuevo.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-rise mx-auto max-w-3xl space-y-4">
      <PageHeader title="Ajustes" subtitle={user?.email ?? undefined} />

      <Card>
        <CardHeader
          title="Perfil"
          subtitle={p ? `${p.displayName ?? "Sin alias"} · ${p.goal ? GOAL_LABEL[p.goal] : "sin objetivo"} · ${p.level ? LEVEL_LABEL[p.level] : "sin nivel"} · ${p.trainingDays.length} días/semana` : undefined}
          action={
            <LinkButton href="/bienvenida" size="sm" variant="soft">
              <Pencil className="size-4" /> Editar
            </LinkButton>
          }
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Meta de pasos">{(id) => <Input id={id} inputMode="numeric" value={form.stepsTarget} onChange={(e) => setForm({ ...form, stepsTarget: e.target.value })} />}</Field>
          <Field label="Descanso por defecto (s)">{(id) => <Input id={id} inputMode="numeric" value={form.rest} onChange={(e) => setForm({ ...form, rest: e.target.value })} />}</Field>
        </div>
        <Button
          className="mt-4"
          variant="soft"
          onClick={() => {
            patchProfile(data.uid, { stepsTarget: parseNum(form.stepsTarget) ?? 8000, restTimerDefaultSec: parseNum(form.rest) ?? 90 });
            toast("Guardado", "success");
          }}
        >
          Guardar
        </Button>
      </Card>

      <Card>
        <CardHeader title="Plan activo" action={<LinkButton href="/rutinas" size="sm" variant="ghost">Biblioteca</LinkButton>} />
        <Select aria-label="Plan activo" value={data.activePlan?.id ?? ""} onChange={(e) => patchProfile(data.uid, { activePlanId: e.target.value || null })}>
          <option value="">Ninguno</option>
          {data.plans.map((pl) => (
            <option key={pl.id} value={pl.id}>
              {pl.name}
            </option>
          ))}
        </Select>
      </Card>

      <Card id="ia">
        <CardHeader title="Coach de IA" />
        <p className="text-sm text-muted">
          Usa Gemini (Google) con tus métricas: series, cargas, peso, medidas, comidas, notas y tu edad. Nunca tu nombre, email ni fecha de nacimiento.
          {AI_TIER === "free" && <b className="text-ink"> Capa gratuita: Google puede usar ese contenido para mejorar sus productos.</b>}
        </p>
        <div className="mt-3 rounded-2xl bg-sunken px-3">
          <Toggle
            checked={!!p?.aiConsent?.accepted}
            onChange={(v) => patchProfile(data.uid, { aiConsent: { accepted: v, at: v ? Date.now() : null } })}
            label="Acepto usar el coach de IA con mis datos"
            description="Desactivarlo detiene cualquier envío nuevo a la IA. Tus informes y chats anteriores se conservan hasta que los borres."
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Apariencia" />
        <Segmented
          label="Tema"
          value={theme}
          onChange={(t) => {
            setTheme(t);
            try {
              localStorage.setItem(THEME_KEY, t);
            } catch {
              /* storage unavailable */
            }
            applyTheme(t);
          }}
          options={[
            { value: "system", label: "Sistema" },
            { value: "light", label: "Claro" },
            { value: "dark", label: "Oscuro" },
          ]}
        />
      </Card>

      <Card>
        <CardHeader title="Tus datos" subtitle="Descárgalos, restaura un respaldo o borra tu cuenta" />
        <div className="flex flex-wrap gap-2">
          <Button variant="soft" onClick={() => doExport("json")} disabled={busy}>
            <FileJson className="size-4" /> Exportar JSON
          </Button>
          <Button variant="soft" onClick={() => doExport("csv")} disabled={busy}>
            <FileSpreadsheet className="size-4" /> Exportar CSV
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" /> Importar respaldo
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                setPendingImport(parseBackup(await f.text()));
              } catch (err) {
                toast((err as Error).message, "error");
              }
            }}
          />
        </div>
        <p className="mt-2 text-xs text-muted">El CSV trae una fila por serie, medida, comida y día de actividad.</p>
        <div className="mt-4 border-t border-line pt-4">
          <Button variant="danger" onClick={() => setDeleting(true)}>
            <Trash2 className="size-4" /> Borrar mi cuenta y todos mis datos
          </Button>
        </div>
      </Card>

      <Card>
        <div className="flex gap-3 text-sm text-muted">
          <ShieldCheck className="size-5 shrink-0 text-primary" />
          <p>
            Solo tú puedes leer tus datos (ni siquiera el administrador). Detalles en la{" "}
            <Link href="/privacidad" className="font-semibold text-primary underline">
              política de privacidad
            </Link>
            .
          </p>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        {isAdmin && (
          <LinkButton href="/admin" variant="outline">
            <UserCog className="size-4" /> Panel de administración
          </LinkButton>
        )}
        <Button variant="ghost" onClick={signOut}>
          <LogOut className="size-4" /> Cerrar sesión
        </Button>
      </div>

      <Sheet
        open={!!pendingImport}
        onClose={() => setPendingImport(null)}
        title="¿Importar respaldo?"
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setPendingImport(null)}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              disabled={busy}
              onClick={() => {
                if (!pendingImport) return;
                const b = pendingImport;
                setPendingImport(null);
                setBusy(true);
                importBackup(data.uid, b)
                  .then(() => toast("Respaldo importado", "success"))
                  .catch(() => toast("Error al importar el respaldo", "error"))
                  .finally(() => setBusy(false));
                if (!navigator.onLine) toast("Sin conexión: se importará al volver la señal.", "info");
              }}
            >
              Importar
            </Button>
          </div>
        }
      >
        {pendingImport && (
          <div className="space-y-2 text-sm">
            <p className="text-muted">Exportado el {new Date(pendingImport.exportedAt).toLocaleString("es-CO")}. Los documentos con el mismo id se sobrescriben; nada se borra.</p>
            <ul className="grid grid-cols-2 gap-1">
              {Object.entries(pendingImport.collections).map(([k, v]) => (
                <li key={k} className="rounded-xl bg-sunken px-3 py-1.5">
                  {k}: <b>{v?.length ?? 0}</b>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Sheet>
      {deleting && <DeleteAccountSheet onClose={() => setDeleting(false)} />}
    </div>
  );
}

function DeleteAccountSheet({ onClose }: { onClose: () => void }) {
  const { user, signOut } = useAuth();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function del() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      // A fresh token proves a recent sign-in (the server checks auth_time).
      await user.getIdToken(true);
      const res = await authedFetch(user, "/api/account/delete", { method: "POST", body: JSON.stringify({ confirm }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "No se pudo borrar la cuenta");
      try {
        localStorage.clear();
      } catch {
        /* ignore */
      }
      await signOut().catch(() => {});
      window.location.replace("/login");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Borrar mi cuenta"
      footer={
        <Button variant="danger" className="w-full" disabled={confirm !== "BORRAR" || busy} onClick={del}>
          {busy && <Loader2 className="size-4 animate-spin" />} Borrar todo definitivamente
        </Button>
      }
    >
      <div className="space-y-3 text-sm">
        <p>
          Se eliminan tu cuenta y <b>todos</b> tus datos: perfil, planes, entrenamientos, medidas, comidas, chats, informes y memorias del coach. No se puede deshacer.
        </p>
        <p className="text-muted">Te recomendamos exportar un respaldo antes. Si iniciaste sesión hace tiempo, te pediremos volver a entrar.</p>
        <Field label='Escribe "BORRAR" para confirmar'>{(id) => <Input id={id} value={confirm} onChange={(e) => setConfirm(e.target.value.toUpperCase())} />}</Field>
        {error && <p className="rounded-2xl bg-danger-soft px-3 py-2 text-danger">{error}</p>}
      </div>
    </Sheet>
  );
}
