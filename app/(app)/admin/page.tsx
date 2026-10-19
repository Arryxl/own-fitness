"use client";

import { AlertTriangle, Ban, CheckCircle2, Loader2, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { DailyBars } from "@/components/charts/Charts";
import { authedFetch, useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Badge, Button, Card, CardHeader, EmptyState, IconButton, PageHeader, ProgressBar, Sheet, Stat } from "@/components/ui";
import { fmtNum } from "@/lib/format";

interface Overview {
  users: { total: number; disabled: number; verified: number; newLast7: number };
  ai: { days: { day: string; count: number; tokens: number }[]; limits: { userRequests: number; userTokens: number; globalRequests: number } };
  firestore: {
    source: string;
    reads: number | null;
    writes: number | null;
    deletes: number | null;
    note?: string;
    quota: { reads: number; writes: number; deletes: number };
    ratios: Record<string, number | null>;
    alert: boolean;
    alertRatio: number;
  };
}

interface AdminUser {
  uid: string;
  email: string | null;
  verified: boolean;
  providers: string[];
  disabled: boolean;
  admin: boolean;
  createdAt: string;
  lastSignInAt: string;
}

export default function AdminPage() {
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState<AdminUser | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [o, u] = await Promise.all([authedFetch(user, "/api/admin/overview"), authedFetch(user, "/api/admin/users")]);
      if (!o.ok || !u.ok) throw new Error((await o.json().catch(() => ({}))).error ?? "Sin acceso");
      setOverview(await o.json());
      const uj = await u.json();
      setUsers(uj.users);
      setNext(uj.nextPageToken);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    // Fetching on mount is the point of this panel.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isAdmin) load();
  }, [isAdmin, load]);

  if (!isAdmin)
    return (
      <Card>
        <EmptyState icon={<ShieldCheck className="size-6" />} title="Solo para administradores" />
      </Card>
    );

  async function more() {
    if (!user || !next) return;
    const res = await authedFetch(user, `/api/admin/users?pageToken=${encodeURIComponent(next)}`);
    const j = await res.json();
    setUsers((x) => [...x, ...j.users]);
    setNext(j.nextPageToken);
  }

  async function setBlocked(u: AdminUser, blocked: boolean) {
    if (!user) return;
    const res = await authedFetch(user, "/api/admin/block", { method: "POST", body: JSON.stringify({ uid: u.uid, blocked }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return toast(j.error ?? "Error", "error");
    setUsers((xs) => xs.map((x) => (x.uid === u.uid ? { ...x, disabled: blocked } : x)));
    toast(blocked ? "Usuario bloqueado" : "Usuario desbloqueado", "success");
  }

  const today = overview?.ai.days.at(-1);
  const fs = overview?.firestore;

  return (
    <div className="animate-rise space-y-4">
      <PageHeader
        title="Administración"
        subtitle="Métricas agregadas y cuentas. Este panel no puede ver entrenamientos, medidas ni chats de nadie."
        action={
          <IconButton label="Actualizar" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="size-5 animate-spin" /> : <RefreshCw className="size-5" />}
          </IconButton>
        }
      />
      {fs?.alert && (
        <p className="flex items-start gap-2 rounded-2xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger" role="alert">
          <AlertTriangle className="size-5 shrink-0" /> El uso de Firestore de hoy superó el {Math.round((fs.alertRatio ?? 0.7) * 100)} % de la cuota gratuita.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Usuarios" action={<Users className="size-5 text-primary" />} />
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Total" value={overview?.users.total ?? "—"} />
            <Stat label="Nuevos (7 d)" value={overview?.users.newLast7 ?? "—"} />
            <Stat label="Verificados" value={overview?.users.verified ?? "—"} />
            <Stat label="Bloqueados" value={overview?.users.disabled ?? "—"} />
          </div>
        </Card>
        <Card>
          <CardHeader title="IA hoy" subtitle={`Tope global ${fmtNum(overview?.ai.limits.globalRequests, 0)} consultas/día`} />
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Consultas" value={fmtNum(today?.count ?? 0, 0)} />
            <Stat label="Tokens" value={fmtNum(today?.tokens ?? 0, 0)} />
          </div>
          <div className="mt-3">
            <ProgressBar value={overview ? (today?.count ?? 0) / overview.ai.limits.globalRequests : 0} color="var(--violet)" label="Consultas vs tope global" />
          </div>
          <p className="mt-2 text-xs text-muted">
            Por usuario: {overview?.ai.limits.userRequests} consultas y {fmtNum(overview?.ai.limits.userTokens, 0)} tokens al día.
          </p>
        </Card>
        <Card>
          <CardHeader title="Firestore hoy" subtitle="Cuota gratuita Spark (se reinicia a medianoche del Pacífico)" />
          {fs && fs.source === "monitoring" ? (
            <div className="space-y-3 text-sm">
              {(["reads", "writes", "deletes"] as const).map((k) => (
                <div key={k}>
                  <div className="flex justify-between">
                    <span>{k === "reads" ? "Lecturas" : k === "writes" ? "Escrituras" : "Borrados"}</span>
                    <span className="num font-semibold">
                      {fmtNum(fs[k], 0)} / {fmtNum(fs.quota[k], 0)}
                    </span>
                  </div>
                  <ProgressBar value={fs.ratios[k] ?? 0} color={(fs.ratios[k] ?? 0) >= fs.alertRatio ? "var(--danger)" : "var(--primary)"} label={k} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">{fs?.note ?? "Cargando…"}</p>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Consultas a la IA (14 días)" />
        {overview && <DailyBars data={overview.ai.days.map((d) => ({ date: d.day, value: d.count }))} goal={overview.ai.limits.globalRequests} unit="consultas" color="var(--violet)" />}
      </Card>

      <Card>
        <CardHeader title="Cuentas" subtitle="Solo metadatos de la cuenta" />
        <ul className="divide-y divide-line">
          {users.map((u) => (
            <li key={u.uid} className="flex min-h-14 flex-wrap items-center gap-2 py-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{u.email ?? u.uid}</span>
                <span className="block text-xs text-muted">
                  Alta {new Date(u.createdAt).toLocaleDateString("es-CO")} · último acceso {u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleDateString("es-CO") : "—"} · {u.providers.join(", ")}
                </span>
              </span>
              {u.admin && <Badge tone="violet">Admin</Badge>}
              {!u.verified && <Badge tone="amber">Sin verificar</Badge>}
              {u.disabled ? <Badge tone="danger">Bloqueado</Badge> : <Badge tone="primary">Activo</Badge>}
              {u.uid !== user?.uid && (
                <Button size="sm" variant={u.disabled ? "soft" : "danger"} onClick={() => setConfirm(u)}>
                  {u.disabled ? <CheckCircle2 className="size-4" /> : <Ban className="size-4" />} {u.disabled ? "Desbloquear" : "Bloquear"}
                </Button>
              )}
            </li>
          ))}
        </ul>
        {next && (
          <Button variant="ghost" className="mt-2 w-full" onClick={more}>
            Cargar más
          </Button>
        )}
      </Card>

      <Sheet
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.disabled ? "¿Desbloquear cuenta?" : "¿Bloquear cuenta?"}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setConfirm(null)}>
              Cancelar
            </Button>
            <Button
              variant={confirm?.disabled ? "primary" : "danger"}
              className="flex-1"
              onClick={() => {
                if (confirm) setBlocked(confirm, !confirm.disabled);
                setConfirm(null);
              }}
            >
              Confirmar
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted">
          {confirm?.disabled
            ? "La persona podrá volver a iniciar sesión."
            : "No podrá iniciar sesión ni usar la IA. Sus datos no se borran (solo ella puede borrarlos). Si tenía la app abierta, puede seguir sincronizando hasta 1 hora."}
        </p>
      </Sheet>
    </div>
  );
}
