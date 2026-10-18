"use client";

import clsx from "clsx";
import { ArrowLeft, ArrowRight, CalendarDays, Dumbbell, Loader2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useData } from "@/components/providers/DataProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Button, Field, Input, parseNum } from "@/components/ui";
import { seedUser } from "@/lib/db/seed";

const STEPS = ["Hola", "Tus datos", "Tu plan", "Extras"] as const;

export default function WelcomePage() {
  const data = useData();
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ height: "", weight: "", waist: "", plan: "plan_3d", budget: "", steps: "" });

  // Profile exists (already onboarded, or the seed just landed in the local cache): go home.
  useEffect(() => {
    if (data.profileState === "ready") router.replace("/");
  }, [data.profileState, router]);

  async function finish() {
    setSaving(true);
    try {
      // The local cache updates immediately and the effect above navigates;
      // the commit promise only resolves once the server has the data.
      await seedUser(data.uid, {
        heightCm: parseNum(f.height),
        weightKg: parseNum(f.weight),
        waistCm: parseNum(f.waist),
        planId: f.plan,
        weeklyBudget: parseNum(f.budget),
        stepsBaseline: parseNum(f.steps),
      });
    } catch (e) {
      setSaving(false);
      toast(`No se pudo guardar: ${(e as Error).message}`, "error");
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 py-8">
      <div className="mb-6 flex gap-1.5" aria-label={`Paso ${step + 1} de ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <span key={s} className={clsx("h-1.5 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-sunken")} />
        ))}
      </div>

      <div className="glass animate-rise flex-1 rounded-[2rem] p-6" key={step}>
        {step === 0 && (
          <div className="space-y-4">
            <span className="flex size-14 items-center justify-center rounded-3xl bg-primary text-on-primary">
              <Dumbbell className="size-7 -rotate-30" />
            </span>
            <h1 className="text-3xl font-extrabold leading-tight">
              Vamos a <span className="text-primary">empezar</span>
            </h1>
            <p className="text-muted">
              Prepararé tu catálogo de ejercicios (con alternativas sin compañero), los planes de 3 y 4 días, el catálogo de alimentos baratos y tus marcas iniciales.
            </p>
            <p className="flex gap-2 rounded-2xl bg-sunken p-3 text-sm text-muted">
              <ShieldCheck className="size-5 shrink-0 text-primary" /> Puedes omitir cualquier dato y completarlo después. Nada se bloquea por datos faltantes.
            </p>
          </div>
        )}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-extrabold">Tus datos de hoy</h2>
            <p className="text-sm text-muted">Opcional. La cintura se mide a la altura del ombligo.</p>
            <Field label="Estatura (cm)">{(id) => <Input id={id} inputMode="decimal" placeholder="182" value={f.height} onChange={(e) => setF({ ...f, height: e.target.value })} />}</Field>
            <Field label="Peso (kg)">{(id) => <Input id={id} inputMode="decimal" placeholder="73,5" value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} />}</Field>
            <Field label="Cintura (cm)">{(id) => <Input id={id} inputMode="decimal" value={f.waist} onChange={(e) => setF({ ...f, waist: e.target.value })} />}</Field>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-extrabold">¿Qué plan usas?</h2>
            {[
              { id: "plan_3d", title: "3 días · L-M-V", text: "Cuerpo completo con énfasis en torso." },
              { id: "plan_4d", title: "4 días · L-M-V + flotante", text: "Día extra (martes o jueves) de brazos, hombros y pecho superior. Lo activas semana a semana." },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={f.plan === p.id}
                onClick={() => setF({ ...f, plan: p.id })}
                className={clsx(
                  "flex w-full items-start gap-3 rounded-3xl border-2 p-4 text-left transition",
                  f.plan === p.id ? "border-primary bg-primary-soft/60" : "border-line bg-surface-strong",
                )}
              >
                <CalendarDays className="mt-0.5 size-5 shrink-0 text-primary" />
                <span>
                  <span className="block font-bold">{p.title}</span>
                  <span className="block text-sm text-muted">{p.text}</span>
                </span>
              </button>
            ))}
            <p className="text-xs text-muted">Puedes cambiarlo y editar las plantillas cuando quieras.</p>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-extrabold">Últimos detalles</h2>
            <Field label="Presupuesto semanal de comida (COP)" hint="Lo usa la IA para armar menús. Opcional.">
              {(id) => <Input id={id} inputMode="numeric" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} />}
            </Field>
            <Field label="Pasos diarios actuales (aprox.)" hint="Tu meta será esto + 2 500, entre 8 000 y 10 000.">
              {(id) => <Input id={id} inputMode="numeric" value={f.steps} onChange={(e) => setF({ ...f, steps: e.target.value })} />}
            </Field>
          </div>
        )}
      </div>

      <div className="mt-6 flex gap-2">
        {step > 0 && (
          <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={saving}>
            <ArrowLeft className="size-4" /> Atrás
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button className="flex-1" onClick={() => setStep(step + 1)}>
            {step === 1 && !f.weight && !f.height ? "Omitir" : "Siguiente"} <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button className="flex-1" onClick={finish} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null} Empezar
          </Button>
        )}
      </div>
    </main>
  );
}
