"use client";

import { Download, FileJson, FileSpreadsheet, LogOut, RotateCcw, ShieldCheck, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useData } from "@/components/providers/DataProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Button, Card, CardHeader, Field, Input, PageHeader, Segmented, Select, Sheet, parseNum } from "@/components/ui";
import { backupToCsv, download, exportAll, importBackup, parseBackup, type Backup } from "@/lib/backup";
import { patchProfile } from "@/lib/db/write";
import { demoReset, isDemo } from "@/lib/demo";
import { THEME_KEY, applyTheme, readTheme, type Theme } from "@/lib/theme";

export default function SettingsPage() {
  const data = useData();
  const { user, signOut } = useAuth();
  const toast = useToast();
  const p = data.profile;
  const [form, setForm] = useState({
    heightCm: p?.heightCm != null ? String(p.heightCm) : "",
    startWeightKg: p?.startWeightKg != null ? String(p.startWeightKg) : "",
    startDate: p?.startDate ?? "",
    weeklyBudget: p?.weeklyBudget != null ? String(p.weeklyBudget) : "",
    stepsTarget: String(p?.stepsTarget ?? 8000),
    rest: String(p?.restTimerDefaultSec ?? 90),
  });
  const [theme, setTheme] = useState<Theme>(() => readTheme());
  const [pendingImport, setPendingImport] = useState<Backup | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function saveProfile() {
    patchProfile(data.uid, {
      heightCm: parseNum(form.heightCm),
      startWeightKg: parseNum(form.startWeightKg),
      startDate: form.startDate || null,
      weeklyBudget: parseNum(form.weeklyBudget),
      stepsTarget: parseNum(form.stepsTarget) ?? 8000,
      restTimerDefaultSec: parseNum(form.rest) ?? 90,
    });
    toast("Perfil guardado", "success");
  }

  async function doExport(kind: "json" | "csv") {
    setBusy(true);
    try {
      const b = await exportAll(data.uid);
      const stamp = new Date().toISOString().slice(0, 10);
      if (kind === "json") download(`ironlog-respaldo-${stamp}.json`, JSON.stringify(b, null, 2), "application/json");
      else for (const [name, csv] of Object.entries(backupToCsv(b))) download(`ironlog-${stamp}-${name}`, csv, "text/csv;charset=utf-8");
    } catch (e) {
      toast(`No se pudo exportar: ${(e as Error).message}`, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-rise mx-auto max-w-3xl space-y-4">
      <PageHeader title="Ajustes" subtitle={user?.email ?? (isDemo ? "Modo demo" : undefined)} />

      <Card>
        <CardHeader title="Perfil" subtitle="Todo es opcional; nada se bloquea por datos faltantes" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Estatura (cm)">{(id) => <Input id={id} inputMode="decimal" value={form.heightCm} onChange={(e) => setForm({ ...form, heightCm: e.target.value })} />}</Field>
          <Field label="Peso inicial (kg)">{(id) => <Input id={id} inputMode="decimal" value={form.startWeightKg} onChange={(e) => setForm({ ...form, startWeightKg: e.target.value })} />}</Field>
          <Field label="Fecha de inicio">{(id) => <Input id={id} type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />}</Field>
          <Field label="Presupuesto semanal (COP)">{(id) => <Input id={id} inputMode="numeric" value={form.weeklyBudget} onChange={(e) => setForm({ ...form, weeklyBudget: e.target.value })} />}</Field>
          <Field label="Meta de pasos">{(id) => <Input id={id} inputMode="numeric" value={form.stepsTarget} onChange={(e) => setForm({ ...form, stepsTarget: e.target.value })} />}</Field>
          <Field label="Descanso por defecto (s)">{(id) => <Input id={id} inputMode="numeric" value={form.rest} onChange={(e) => setForm({ ...form, rest: e.target.value })} />}</Field>
        </div>
        <Button className="mt-4" onClick={saveProfile}>
          Guardar perfil
        </Button>
      </Card>

      <Card>
        <CardHeader title="Plan activo" />
        <Select aria-label="Plan activo" value={data.activePlan?.id ?? ""} onChange={(e) => patchProfile(data.uid, { activePlanId: e.target.value })}>
          {data.plans.map((pl) => (
            <option key={pl.id} value={pl.id}>
              {pl.name}
            </option>
          ))}
        </Select>
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
        <CardHeader title="Respaldo de datos" subtitle="Descarga todo lo tuyo o restaura un respaldo" />
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
        <p className="mt-2 text-xs text-muted">El CSV trae una fila por serie, medida, comida y día de actividad (abre bien en Excel o Google Sheets).</p>
      </Card>

      <Card>
        <CardHeader title="Privacidad" />
        <div className="flex gap-3 text-sm text-muted">
          <ShieldCheck className="size-5 shrink-0 text-primary" />
          <div className="space-y-2">
            <p>
              Tus datos viven en tu proyecto de Firebase y solo tu cuenta de Google puede leerlos (reglas de Firestore + lista blanca en el servidor).
            </p>
            <p>
              <b className="text-ink">Coach IA:</b> usa la capa gratuita de la API de Gemini. En esa capa <b className="text-ink">Google puede usar el contenido enviado para mejorar sus productos</b>. La app solo envía métricas (pesos, series, medidas, comidas, notas) — nunca tu nombre ni tu email. Si no quieres esto, no uses las funciones de IA.
            </p>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        {isDemo ? (
          <Button
            variant="danger"
            onClick={() => {
              demoReset();
              toast("Datos de demo restablecidos", "success");
            }}
          >
            <RotateCcw className="size-4" /> Restablecer demo
          </Button>
        ) : (
          <Button variant="danger" onClick={signOut}>
            <LogOut className="size-4" /> Cerrar sesión
          </Button>
        )}
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
              onClick={async () => {
                if (!pendingImport) return;
                setBusy(true);
                const b = pendingImport;
                setPendingImport(null);
                importBackup(data.uid, b)
                  .then(() => toast("Respaldo importado", "success"))
                  .catch((e) => toast(`Error al importar: ${(e as Error).message}`, "error"))
                  .finally(() => setBusy(false));
                if (!navigator.onLine) toast("Sin conexión: se importará al volver la señal.", "info");
              }}
            >
              <Download className="size-4" /> Importar
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
    </div>
  );
}
