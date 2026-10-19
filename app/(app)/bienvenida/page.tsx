"use client";

import clsx from "clsx";
import { ArrowLeft, ArrowRight, Check, Dumbbell, HeartPulse, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useData } from "@/components/providers/DataProvider";
import { Field, Input, Select, TextArea, Toggle, parseNum } from "@/components/ui";
import { Button } from "@/components/ui";
import { todayISO } from "@/lib/analytics/dates";
import { patchProfile } from "@/lib/db/write";
import { EMPHASIS_DESCRIPTION, EMPHASIS_LABEL, EQUIPMENT_LABEL, GOAL_DESCRIPTION, GOAL_LABEL, LEVEL_LABEL, PLACE_LABEL, WEEKDAY_LONG } from "@/lib/format";
import { COUNTRIES, DIET_RESTRICTIONS, MIN_AGE, PLACE_EQUIPMENT_OFF, defaultProfile, isAdult } from "@/lib/profile";
import type { Emphasis, Equipment, Goal, Level, Place, Profile, Sex, UnitsPref } from "@/lib/types";

const STEPS = ["Bienvenida", "Sobre ti", "Objetivo", "Dónde entrenas", "Comida", "Coach IA"] as const;
const AI_TIER = process.env.NEXT_PUBLIC_GEMINI_TIER ?? "free";
const TOGGLE_EQUIPMENT: Equipment[] = ["machine", "dumbbell", "cable", "smith", "barbell", "rack", "bench", "band", "pullup_bar", "dip_bars"];

type Draft = Omit<Profile, "createdAt" | "schemaVersion" | "timezone" | "activePlanId" | "proteinTargetG" | "stepsBaseline" | "restTimerDefaultSec">;

function draftFrom(p: Profile): Draft {
  const { createdAt: _c, schemaVersion: _s, timezone: _t, activePlanId: _a, proteinTargetG: _p, stepsBaseline: _b, restTimerDefaultSec: _r, ...rest } = p;
  void [_c, _s, _t, _a, _p, _b, _r];
  return rest;
}

export default function WelcomePage() {
  const data = useData();
  const { user } = useAuth();
  const router = useRouter();
  const today = todayISO();
  const editing = !!data.profile?.onboardingCompletedAt;
  const [step, setStep] = useState(() => (editing ? 1 : Math.min(data.profile?.onboardingStep ?? 0, STEPS.length - 1)));
  const [d, setD] = useState<Draft>(() => draftFrom(data.profile ?? defaultProfile(user?.displayName ?? null, Date.now(), today)));
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));

  // First visit: create the profile document so progress can be resumed.
  useEffect(() => {
    if (data.profileState === "missing") patchProfile(data.uid, defaultProfile(user?.displayName ?? null, Date.now(), today));
  }, [data.profileState, data.uid, user, today]);

  const adult = isAdult(d.birthDate, today);
  const valid = [
    !!d.privacyAcceptedAt && !!d.healthAcceptedAt,
    !!d.displayName?.trim() && adult && !!d.heightCm && !!d.startWeightKg,
    !!d.goal && !!d.level && d.trainingDays.length >= 2,
    true,
    !!d.country && !!d.currency,
    true,
  ];

  function save(nextStep: number, extra: Partial<Profile> = {}) {
    patchProfile(data.uid, { ...d, ...extra, onboardingStep: nextStep });
  }

  function next() {
    if (!valid[step]) return;
    if (step < STEPS.length - 1) {
      save(step + 1);
      setStep(step + 1);
      return;
    }
    setSaving(true);
    save(step, { onboardingCompletedAt: data.profile?.onboardingCompletedAt ?? Date.now() });
    router.replace(editing ? "/ajustes" : "/rutinas");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 py-8">
      <div className="mb-2 flex items-center justify-between text-sm text-muted">
        <span>
          Paso {step + 1} de {STEPS.length} · {STEPS[step]}
        </span>
        {editing && (
          <Link href="/ajustes" className="font-semibold text-primary">
            Cancelar
          </Link>
        )}
      </div>
      <div className="mb-6 flex gap-1.5" aria-hidden>
        {STEPS.map((s, i) => (
          <span key={s} className={clsx("h-1.5 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-sunken")} />
        ))}
      </div>

      <div className="glass animate-rise flex-1 space-y-4 rounded-[2rem] p-6" key={step}>
        {step === 0 && (
          <>
            <span className="flex size-14 items-center justify-center rounded-3xl bg-primary text-on-primary">
              <Dumbbell className="size-7 -rotate-30" />
            </span>
            <h1 className="text-3xl font-extrabold leading-tight">
              Bienvenido a <span className="text-primary">IronLog</span>
            </h1>
            <p className="text-muted">Unas preguntas para recomendarte una rutina y calcular tus metas. Puedes dejar esto a medias y retomarlo después.</p>
            <div className="flex gap-3 rounded-2xl bg-amber-soft p-4 text-sm">
              <HeartPulse className="size-5 shrink-0 text-amber" />
              <div>
                <p className="font-semibold text-ink">Aviso de salud</p>
                <p className="mt-1 text-muted">
                  IronLog no sustituye a un médico, fisioterapeuta ni nutricionista. Si tienes una condición de salud, lesión, embarazo, o tomas medicación, consulta a un profesional antes de empezar. Ante dolor agudo, mareo o dolor en el pecho, detén el ejercicio y busca atención.
                </p>
              </div>
            </div>
            <label className="flex min-h-12 items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 size-5 accent-[var(--primary)]" checked={!!d.healthAcceptedAt} onChange={(e) => set({ healthAcceptedAt: e.target.checked ? Date.now() : null })} />
              <span>Entiendo y acepto el aviso de salud.</span>
            </label>
            <label className="flex min-h-12 items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 size-5 accent-[var(--primary)]" checked={!!d.privacyAcceptedAt} onChange={(e) => set({ privacyAcceptedAt: e.target.checked ? Date.now() : null })} />
              <span>
                He leído y acepto la{" "}
                <Link href="/privacidad" target="_blank" className="font-semibold text-primary underline">
                  política de privacidad
                </Link>{" "}
                (qué datos se guardan, para qué y cómo borrarlos).
              </span>
            </label>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="text-2xl font-extrabold">Sobre ti</h2>
            <Field label="Nombre o alias">{(id) => <Input id={id} value={d.displayName ?? ""} onChange={(e) => set({ displayName: e.target.value.slice(0, 40) })} />}</Field>
            <Field label="Fecha de nacimiento" hint={`Solo mayores de ${MIN_AGE} años. No se comparte con la IA (solo tu edad).`}>
              {(id) => <Input id={id} type="date" max={today} value={d.birthDate ?? ""} onChange={(e) => set({ birthDate: e.target.value || null })} />}
            </Field>
            {d.birthDate && !adult && (
              <p role="alert" className="rounded-2xl bg-danger-soft px-3 py-2 text-sm text-danger">
                IronLog es solo para mayores de {MIN_AGE} años.
              </p>
            )}
            <fieldset>
              <legend className="text-sm font-semibold">Sexo (para la fórmula de gasto energético)</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(
                  [
                    ["male", "Hombre"],
                    ["female", "Mujer"],
                    ["other", "Prefiero no decir"],
                  ] as [Sex, string][]
                ).map(([v, l]) => (
                  <Chip key={v} on={d.sex === v} onClick={() => set({ sex: v })}>
                    {l}
                  </Chip>
                ))}
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Estatura (cm)">{(id) => <Input id={id} inputMode="decimal" value={d.heightCm ?? ""} onChange={(e) => set({ heightCm: parseNum(e.target.value) })} />}</Field>
              <Field label="Peso (kg)">{(id) => <Input id={id} inputMode="decimal" value={d.startWeightKg ?? ""} onChange={(e) => set({ startWeightKg: parseNum(e.target.value) })} />}</Field>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-2xl font-extrabold">Tu objetivo</h2>
            <div className="grid gap-2">
              {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => (
                <Card key={g} on={d.goal === g} onClick={() => set({ goal: g })} title={GOAL_LABEL[g]} text={GOAL_DESCRIPTION[g]} />
              ))}
            </div>
            <fieldset>
              <legend className="text-sm font-semibold">¿Qué quieres priorizar?</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(Object.keys(EMPHASIS_LABEL) as Emphasis[]).map((e) => (
                  <Chip key={e} on={(d.emphasis ?? "equilibrado") === e} onClick={() => set({ emphasis: e })}>
                    {EMPHASIS_LABEL[e]}
                  </Chip>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted">{EMPHASIS_DESCRIPTION[d.emphasis ?? "equilibrado"]} Lo usamos para recomendarte rutinas; puedes cambiarlo cuando quieras.</p>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-semibold">Nivel</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(Object.keys(LEVEL_LABEL) as Level[]).map((l) => (
                  <Chip key={l} on={d.level === l} onClick={() => set({ level: l })}>
                    {LEVEL_LABEL[l]}
                  </Chip>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted">Principiante: menos de ~6 meses entrenando de forma constante.</p>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-semibold">¿Qué días puedes entrenar?</legend>
              <div className="mt-2 grid grid-cols-7 gap-1.5">
                {WEEKDAY_LONG.map((w, i) => {
                  const day = i + 1;
                  const on = d.trainingDays.includes(day);
                  return (
                    <button
                      key={w}
                      type="button"
                      aria-pressed={on}
                      aria-label={w}
                      onClick={() => set({ trainingDays: on ? d.trainingDays.filter((x) => x !== day) : [...d.trainingDays, day].sort() })}
                      className={clsx("h-12 rounded-xl text-sm font-bold capitalize", on ? "bg-primary text-on-primary" : "bg-sunken text-muted")}
                    >
                      {w.slice(0, 2)}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-muted">{d.trainingDays.length} días por semana (mínimo 2).</p>
            </fieldset>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-2xl font-extrabold">¿Dónde entrenas?</h2>
            <div className="grid gap-2">
              {(Object.keys(PLACE_LABEL) as Place[]).map((pl) => (
                <Card
                  key={pl}
                  on={(d.trainingPlace ?? "gym") === pl}
                  onClick={() => set({ trainingPlace: pl, unavailableEquipment: [...PLACE_EQUIPMENT_OFF[pl]] })}
                  title={PLACE_LABEL[pl]}
                  text={pl === "gym" ? "Máquinas, poleas, mancuernas y barras." : pl === "home" ? "Mancuernas ajustables, bandas y quizá un banco." : "Barra de dominadas o parque; nada más."}
                />
              ))}
            </div>
            <p className="text-sm text-muted">Desmarca lo que no hay. Los ejercicios que lo necesiten quedarán como no disponibles y la app usará sus alternativas. Lo puedes ajustar ejercicio por ejercicio después.</p>
            <div className="rounded-2xl bg-sunken px-3">
              {TOGGLE_EQUIPMENT.map((e) => (
                <Toggle
                  key={e}
                  label={EQUIPMENT_LABEL[e]}
                  checked={!d.unavailableEquipment.includes(e)}
                  onChange={(on) => set({ unavailableEquipment: on ? d.unavailableEquipment.filter((x) => x !== e) : [...d.unavailableEquipment, e] })}
                />
              ))}
            </div>
            <Field label="Lesiones o molestias (opcional)" hint="Ej.: molestia en hombro derecho al empujar por encima de la cabeza. El coach lo tendrá en cuenta; no diagnostica.">
              {(id) => <TextArea id={id} value={d.injuries} maxLength={500} onChange={(e) => set({ injuries: e.target.value })} />}
            </Field>
            <Field label="Unidades de peso">
              {(id) => (
                <Select id={id} value={d.units} onChange={(e) => set({ units: e.target.value as UnitsPref })}>
                  <option value="mixed">Mixto: según el equipo (mancuernas y máquinas en lb)</option>
                  <option value="kg">Todo en kg</option>
                  <option value="lb">Todo en lb</option>
                </Select>
              )}
            </Field>
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="text-2xl font-extrabold">Comida</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="País">
                {(id) => (
                  <Select
                    id={id}
                    value={d.country}
                    onChange={(e) => {
                      const c = COUNTRIES.find((x) => x.code === e.target.value);
                      set({ country: e.target.value, currency: c?.currency ?? d.currency });
                    }}
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Moneda">{(id) => <Input id={id} value={d.currency} maxLength={3} onChange={(e) => set({ currency: e.target.value.toUpperCase() })} />}</Field>
            </div>
            <Field label={`Presupuesto semanal de comida (${d.currency})`} hint="Opcional. La IA lo usa para proponer menús; nunca inventa precios.">
              {(id) => <Input id={id} inputMode="numeric" value={d.weeklyBudget ?? ""} onChange={(e) => set({ weeklyBudget: parseNum(e.target.value) })} />}
            </Field>
            <fieldset>
              <legend className="text-sm font-semibold">Restricciones alimentarias</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {DIET_RESTRICTIONS.map((r) => {
                  const on = d.dietaryRestrictions.includes(r.id);
                  return (
                    <Chip key={r.id} on={on} onClick={() => set({ dietaryRestrictions: on ? d.dietaryRestrictions.filter((x) => x !== r.id) : [...d.dietaryRestrictions, r.id] })}>
                      {r.label}
                    </Chip>
                  );
                })}
              </div>
            </fieldset>
            <Field label="Otras restricciones o alergias (opcional)">{(id) => <Input id={id} value={d.dietNotes} maxLength={200} onChange={(e) => set({ dietNotes: e.target.value })} />}</Field>
          </>
        )}

        {step === 5 && (
          <>
            <span className="flex size-12 items-center justify-center rounded-2xl bg-violet-soft text-violet">
              <Sparkles className="size-6" />
            </span>
            <h2 className="text-2xl font-extrabold">Coach de IA (opcional)</h2>
            <p className="text-sm text-muted">
              El coach usa Gemini (Google) para analizar tus métricas: series, cargas, peso, medidas, comidas y notas. Nunca enviamos tu nombre, email ni fecha de nacimiento (solo tu edad).
            </p>
            {AI_TIER === "free" && (
              <p className="flex gap-2 rounded-2xl bg-amber-soft p-3 text-sm text-amber">
                <ShieldCheck className="size-5 shrink-0" /> Usamos la capa gratuita de Gemini: Google puede usar el contenido que se envía para mejorar sus productos.
              </p>
            )}
            <div className="rounded-2xl bg-sunken px-3">
              <Toggle
                checked={d.aiConsent.accepted}
                onChange={(v) => set({ aiConsent: { accepted: v, at: v ? Date.now() : null } })}
                label="Acepto usar el coach de IA con mis datos"
                description="Puedes activarlo o desactivarlo cuando quieras en Ajustes. Sin esto, todo lo demás funciona igual."
              />
            </div>
          </>
        )}
      </div>

      <div className="mt-6 flex gap-2">
        {step > 0 && (
          <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={saving}>
            <ArrowLeft className="size-4" /> Atrás
          </Button>
        )}
        <Button className="flex-1" onClick={next} disabled={!valid[step] || saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : step === STEPS.length - 1 ? <Check className="size-4" /> : null}
          {step === STEPS.length - 1 ? (editing ? "Guardar cambios" : "Ver rutinas recomendadas") : "Siguiente"}
          {step < STEPS.length - 1 && <ArrowRight className="size-4" />}
        </Button>
      </div>
    </main>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={clsx("min-h-11 rounded-full px-4 text-sm font-semibold", on ? "bg-primary text-on-primary" : "bg-sunken text-muted")}>
      {children}
    </button>
  );
}

function Card({ on, onClick, title, text }: { on: boolean; onClick: () => void; title: string; text: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={clsx("flex w-full items-start gap-3 rounded-3xl border-2 p-4 text-left transition", on ? "border-primary bg-primary-soft/60" : "border-line bg-surface-strong")}
    >
      <span className={clsx("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2", on ? "border-primary bg-primary text-on-primary" : "border-line")}>{on && <Check className="size-3" />}</span>
      <span>
        <span className="block font-bold">{title}</span>
        <span className="block text-sm text-muted">{text}</span>
      </span>
    </button>
  );
}
