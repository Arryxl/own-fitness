"use client";

import { Check, Loader2, Pencil, Plus, ShoppingCart, Sparkles, Trash2, Utensils } from "lucide-react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { useData } from "@/components/providers/DataProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Badge, Button, Card, CardHeader, EmptyState, Field, IconButton, Input, PageHeader, ProgressBar, Ring, Segmented, Select, Sheet, Stat, TextArea, parseNum } from "@/components/ui";
import { addDays } from "@/lib/analytics/dates";
import { dailyMeans, movingAverage7d } from "@/lib/analytics/bodyweight";
import { copPer25gProtein, nutritionSummary, proteinByDay, proteinRange, proteinTarget, sortByProteinCost } from "@/lib/analytics/nutrition";
import { ageFromBirthDate, energyTargets } from "@/lib/analytics/energy";
import { excludedFoodTags } from "@/lib/profile";
import { round } from "@/lib/analytics/units";
import type { MenuOut } from "@/lib/ai/schemas";
import { newId, patchProfile, putDoc, removeDoc } from "@/lib/db/write";

import { getDb } from "@/lib/firebase/client";
import { fmtCop, fmtNum } from "@/lib/format";
import { useAiEnabled, useAiPost } from "@/lib/hooks/useAi";
import { useToday } from "@/lib/hooks/useToday";
import type { Food, MealItem } from "@/lib/types";

type MealEstimate = { items: MealItem[]; proteinG: number; kcal: number | null; confidence: "low" | "medium" | "high"; notes: string };

export default function NutritionPage() {
  const data = useData();
  const { today } = useToday();
  const [adding, setAdding] = useState(false);
  const [editingFood, setEditingFood] = useState<Food | null>(null);

  const weight = useMemo(() => movingAverage7d(dailyMeans(data.bodyMetrics, "weightKg")).at(-1)?.value ?? data.profile?.startWeightKg ?? null, [data.bodyMetrics, data.profile]);
  const range = proteinRange(weight);
  const target = proteinTarget(data.profile?.proteinTargetG, weight);
  const todays = data.meals.filter((m) => m.date === today).sort((a, b) => a.ts - b.ts);
  const proteinToday = proteinByDay(todays).get(today) ?? 0;
  const week = nutritionSummary(
    data.meals.filter((m) => m.date >= addDays(today, -6)),
    target,
  );
  const foods = useMemo(() => sortByProteinCost(data.foods), [data.foods]);
  const currency = data.profile?.currency ?? "COP";
  const excluded = excludedFoodTags(data.profile?.dietaryRestrictions ?? []);
  const energy = energyTargets({
    sex: data.profile?.sex ?? null,
    ageYears: ageFromBirthDate(data.profile?.birthDate ?? null, today),
    heightCm: data.profile?.heightCm ?? null,
    weightKg: weight,
    trainingDaysPerWeek: data.profile?.trainingDays.length ?? 3,
    goal: data.profile?.goal ?? null,
  });

  return (
    <div className="animate-rise space-y-4">
      <PageHeader
        title="Nutrición"
        subtitle="La proteína es el factor nutricional que más pesa en la recomposición"
        action={
          <Button variant="accent" onClick={() => setAdding(true)}>
            <Plus className="size-5" /> <span className="hidden sm:inline">Registrar comida</span>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Proteína de hoy" />
          <div className="flex items-center gap-4">
            <Ring value={target ? proteinToday / target : 0} color="var(--accent)" size={110} label={`Proteína de hoy: ${fmtNum(proteinToday, 0)} de ${target ?? "?"} g`}>
              <span className="num text-xl font-extrabold">{fmtNum(proteinToday, 0)}</span>
              <span className="text-[0.7rem] text-muted">de {target ?? "—"} g</span>
            </Ring>
            <div className="min-w-0 flex-1 space-y-1 text-sm">
              <p>
                Rango: <b className="num">{range ? `${range.min}-${range.max} g/día` : "registra tu peso"}</b>
              </p>
              <p className="text-muted">1,6-2,2 g por kg de peso. Acercarse ya ayuda.</p>
              <TargetEditor current={data.profile?.proteinTargetG ?? null} suggested={range?.min ?? null} />
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Últimos 7 días" />
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Promedio" value={fmtNum(week.avgProteinG, 0)} unit="g/día" />
            <Stat label="Días en la meta" value={week.daysHitTarget} unit={`/ ${week.daysLogged}`} />
          </div>
          <div className="mt-3">
            <ProgressBar value={week.hitRatePct != null ? week.hitRatePct / 100 : 0} color="var(--accent)" label="Días en la meta" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Energía estimada" subtitle="Rangos, no cifras exactas (Mifflin-St Jeor)" />
          {energy ? (
            <div className="space-y-1.5 text-sm">
              <p>
                Calorías: <b className="num">{fmtNum(energy.calories.min, 0)}-{fmtNum(energy.calories.max, 0)} kcal/día</b>
              </p>
              <p className="text-muted">
                Mantenimiento ≈ {fmtNum(energy.maintenance.min, 0)}-{fmtNum(energy.maintenance.max, 0)} kcal · Grasas {energy.fatG.min}-{energy.fatG.max} g · Carbohidratos {energy.carbsG.min}-{energy.carbsG.max} g
              </p>
              {energy.warnings.map((w) => (
                <p key={w} className="rounded-2xl bg-amber-soft px-3 py-2 text-xs text-amber">
                  {w}
                </p>
              ))}
              <p className="text-xs text-muted">Creatina monohidrato 3-5 g/día: el suplemento mejor respaldado y barato (opcional; si tienes enfermedad renal, consulta a tu médico).</p>
            </div>
          ) : (
            <p className="text-sm text-muted">Completa edad, estatura y peso en tu perfil para estimar tus calorías.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Comidas de hoy" action={<Button size="sm" variant="soft" onClick={() => setAdding(true)}><Plus className="size-4" /> Añadir</Button>} />
          {todays.length === 0 ? (
            <EmptyState icon={<Utensils className="size-6" />} title="Nada registrado hoy">
              Escribe lo que comiste («2 huevos y arroz con lentejas») y la IA estima la proteína; tú confirmas.
            </EmptyState>
          ) : (
            <ul className="space-y-2">
              {todays.map((m) => (
                <li key={m.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface-strong p-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
                    <Check className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{m.text}</span>
                    <span className="text-xs text-muted">
                      {new Date(m.ts).toTimeString().slice(0, 5)} · {m.source === "ai" ? "estimado por IA" : "manual"}
                      {m.kcal ? ` · ${fmtNum(m.kcal, 0)} kcal` : ""}
                    </span>
                  </span>
                  <span className="num font-bold">{fmtNum(m.proteinG, 0)} g</span>
                  <IconButton label="Borrar comida" className="size-10 text-muted" onClick={() => removeDoc(data.uid, "meals", m.id)}>
                    <Trash2 className="size-4" />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <MenuCard />
      </div>

      <Card>
        <CardHeader
          title="Catálogo de proteína barata"
          subtitle={`Escribe lo que pagas en ${currency}; se ordena por costo de 25 g de proteína`}
          action={
            <Button
              size="sm"
              variant="soft"
              onClick={() => setEditingFood({ id: newId(data.uid, "foods"), name: "", portionLabel: "1 porción", proteinG: null, priceCop: null, priceQty: 1 })}
            >
              <Plus className="size-4" /> Alimento
            </Button>
          }
        />
        <ul className="divide-y divide-line">
          {foods.map((f, i) => {
            const cost = copPer25gProtein(f);
            return (
              <li key={f.id}>
                <button type="button" onClick={() => setEditingFood(f)} className="flex min-h-14 w-full items-center gap-3 py-2 text-left">
                  <span className="w-6 text-center text-xs font-bold text-muted">{cost != null ? i + 1 : "·"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {f.name}
                      {(f.tags ?? []).some((t) => excluded.has(t)) && <span className="ml-2 text-xs font-medium text-amber">no compatible con tus restricciones</span>}
                    </span>
                    <span className="block text-xs text-muted">
                      {f.portionLabel} · {f.proteinG != null ? `${fmtNum(f.proteinG)} g proteína` : "proteína por completar"}
                      {f.priceCop ? ` · ${fmtCop(f.priceCop, currency)} / ${f.priceQty ?? 1} porc.` : ""}
                    </span>
                  </span>
                  {cost != null ? (
                    <span className="text-right">
                      <span className="num block font-bold">{fmtCop(cost, currency)}</span>
                      <span className="block text-[0.7rem] text-muted">por 25 g</span>
                    </span>
                  ) : (
                    <Badge>Sin precio</Badge>
                  )}
                  <Pencil className="size-4 text-muted" />
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      <AddMealSheet open={adding} onClose={() => setAdding(false)} />
      {editingFood && <FoodEditor key={editingFood.id} food={editingFood} onClose={() => setEditingFood(null)} />}
    </div>
  );
}

function TargetEditor({ current, suggested }: { current: number | null; suggested: number | null }) {
  const data = useData();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(String(current ?? suggested ?? ""));
  if (!open)
    return (
      <button type="button" className="text-xs font-semibold text-primary underline" onClick={() => setOpen(true)}>
        {current ? `Meta personalizada: ${current} g · cambiar` : "Personalizar meta"}
      </button>
    );
  return (
    <div className="flex gap-2">
      <Input aria-label="Meta de proteína (g)" inputMode="numeric" value={v} onChange={(e) => setV(e.target.value)} className="min-h-10 num" />
      <Button
        size="sm"
        onClick={() => {
          const n = parseNum(v);
          patchProfile(data.uid, { proteinTargetG: n && n > 0 ? Math.round(n) : null });
          setOpen(false);
        }}
      >
        OK
      </Button>
    </div>
  );
}

function AddMealSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const data = useData();
  const post = useAiPost();
  const aiOn = useAiEnabled();
  const toast = useToast();
  const { today } = useToday();
  const [mode, setMode] = useState<"ai" | "catalog" | "manual">(aiOn.enabled ? "ai" : "catalog");
  const [text, setText] = useState("");
  const [protein, setProtein] = useState("");
  const [estimate, setEstimate] = useState<MealEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [foodId, setFoodId] = useState("");
  const [portions, setPortions] = useState("1");
  const withProtein = data.foods.filter((f) => f.proteinG != null);

  function reset() {
    setText("");
    setProtein("");
    setEstimate(null);
    setPortions("1");
  }

  function save(meal: { text: string; items: MealItem[]; proteinG: number; kcal?: number | null; source: "manual" | "ai" }) {
    const id = newId(data.uid, "meals");
    putDoc(data.uid, "meals", id, { ...meal, ts: Date.now(), date: today, estCost: null });
    toast("Comida guardada", "success");
    reset();
    onClose();
  }

  async function estimateAi() {
    setLoading(true);
    try {
      setEstimate(await post<MealEstimate>("/api/ai/meal-estimate", { text }));
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }

  const food = data.foods.find((f) => f.id === foodId);
  const portionsN = parseNum(portions) ?? 0;

  return (
    <Sheet open={open} onClose={onClose} title="Registrar comida">
      <Segmented
        label="Modo"
        value={mode}
        onChange={(m) => {
          setMode(m);
          setEstimate(null);
        }}
        options={[
          { value: "ai", label: "Estimar con IA" },
          { value: "catalog", label: "Catálogo" },
          { value: "manual", label: "Manual" },
        ]}
      />
      <div className="mt-4 space-y-3">
        {mode === "ai" && !estimate && (
          <>
            <TextArea aria-label="¿Qué comiste?" placeholder="Ej.: 2 huevos pericos, arepa y café con leche" value={text} onChange={(e) => setText(e.target.value)} maxLength={600} />
            <Button className="w-full" disabled={text.trim().length < 2 || loading} onClick={estimateAi}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Estimar proteína
            </Button>
            <p className="text-xs text-muted">Verás la estimación para revisarla antes de guardar.</p>
          </>
        )}
        {mode === "ai" && estimate && (
          <EstimateReview estimate={estimate} onChange={setEstimate} onSave={() => save({ text, items: estimate.items, proteinG: round(estimate.proteinG, 1), kcal: estimate.kcal, source: "ai" })} onBack={() => setEstimate(null)} />
        )}
        {mode === "catalog" && (
          <>
            <Select aria-label="Alimento" value={foodId} onChange={(e) => setFoodId(e.target.value)}>
              <option value="">Elige un alimento…</option>
              {withProtein.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.portionLabel}: {f.proteinG} g)
                </option>
              ))}
            </Select>
            <Field label="Porciones">{(id) => <Input id={id} inputMode="decimal" value={portions} onChange={(e) => setPortions(e.target.value)} className="num" />}</Field>
            {food && <p className="text-sm">≈ <b className="num">{fmtNum((food.proteinG ?? 0) * portionsN)} g</b> de proteína</p>}
            <Button
              className="w-full"
              disabled={!food || portionsN <= 0}
              onClick={() =>
                food &&
                save({
                  text: `${fmtNum(portionsN)} × ${food.name} (${food.portionLabel})`,
                  items: [{ name: food.name, grams: food.portionGrams ? food.portionGrams * portionsN : null, proteinG: round((food.proteinG ?? 0) * portionsN, 1) }],
                  proteinG: round((food.proteinG ?? 0) * portionsN, 1),
                  source: "manual",
                })
              }
            >
              Guardar
            </Button>
          </>
        )}
        {mode === "manual" && (
          <>
            <Input aria-label="Descripción" placeholder="Almuerzo: arroz, fríjoles y pollo" value={text} onChange={(e) => setText(e.target.value)} />
            <Field label="Proteína (g)">{(id) => <Input id={id} inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} className="num text-lg font-bold" />}</Field>
            <Button
              className="w-full"
              disabled={!text.trim() || parseNum(protein) == null}
              onClick={() => save({ text: text.trim(), items: [], proteinG: parseNum(protein) ?? 0, source: "manual" })}
            >
              Guardar
            </Button>
          </>
        )}
      </div>
    </Sheet>
  );
}

function EstimateReview({ estimate, onChange, onSave, onBack }: { estimate: MealEstimate; onChange: (e: MealEstimate) => void; onSave: () => void; onBack: () => void }) {
  const setItem = (i: number, proteinG: number) => {
    const items = estimate.items.map((it, j) => (j === i ? { ...it, proteinG } : it));
    onChange({ ...estimate, items, proteinG: items.reduce((t, x) => t + (x.proteinG || 0), 0) });
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge tone={estimate.confidence === "high" ? "primary" : estimate.confidence === "medium" ? "amber" : "danger"}>
          Confianza {estimate.confidence === "high" ? "alta" : estimate.confidence === "medium" ? "media" : "baja"}
        </Badge>
        <span className="text-sm text-muted">Estimación: revisa y ajusta</span>
      </div>
      <ul className="space-y-2">
        {estimate.items.map((it, i) => (
          <li key={i} className="flex items-center gap-2 rounded-2xl bg-sunken p-2 pl-3 text-sm">
            <span className="min-w-0 flex-1">
              {it.name}
              {it.grams ? <span className="text-muted"> · {fmtNum(it.grams, 0)} g</span> : null}
            </span>
            <input
              aria-label={`Proteína de ${it.name}`}
              inputMode="decimal"
              defaultValue={fmtNum(it.proteinG, 1)}
              onChange={(e) => setItem(i, parseNum(e.target.value) ?? 0)}
              className="num h-10 w-16 rounded-xl border border-line bg-surface-strong text-center font-bold"
            />
            <span className="text-muted">g</span>
          </li>
        ))}
      </ul>
      <p className="text-sm">
        Total: <b className="num">{fmtNum(estimate.proteinG, 0)} g</b> proteína{estimate.kcal ? ` · ~${fmtNum(estimate.kcal, 0)} kcal` : ""}
      </p>
      {estimate.notes && <p className="text-xs text-muted">{estimate.notes}</p>}
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onBack}>
          Volver
        </Button>
        <Button className="flex-1" onClick={onSave}>
          <Check className="size-4" /> Confirmar y guardar
        </Button>
      </div>
    </div>
  );
}

function FoodEditor({ food, onClose }: { food: Food; onClose: () => void }) {
  const data = useData();
  const [d, setD] = useState({
    name: food.name,
    portionLabel: food.portionLabel,
    proteinG: food.proteinG != null ? String(food.proteinG) : "",
    priceCop: food.priceCop != null ? String(food.priceCop) : "",
    priceQty: food.priceQty != null ? String(food.priceQty) : "1",
    priceNote: food.priceNote ?? "",
  });
  const isNew = !data.foods.some((f) => f.id === food.id);
  const preview = copPer25gProtein({ priceCop: parseNum(d.priceCop), priceQty: parseNum(d.priceQty), proteinG: parseNum(d.proteinG) });
  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? "Nuevo alimento" : food.name}
      footer={
        <div className="flex gap-2">
          {!isNew && (
            <Button
              variant="danger"
              onClick={() => {
                // Catalog foods are hidden for this user; custom foods are deleted.
                if (data.catalog.foods.some((c) => c.id === food.id)) putDoc(data.uid, "foods", food.id, { ...food, hidden: true });
                else removeDoc(data.uid, "foods", food.id);
                onClose();
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
          <Button
            className="flex-1"
            disabled={!d.name.trim()}
            onClick={() => {
              putDoc(data.uid, "foods", food.id, {
                ...food,
                name: d.name.trim(),
                portionLabel: d.portionLabel.trim() || "1 porción",
                proteinG: parseNum(d.proteinG),
                priceCop: parseNum(d.priceCop),
                priceQty: parseNum(d.priceQty) ?? 1,
                priceNote: d.priceNote,
              });
              onClose();
            }}
          >
            Guardar
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Field label="Nombre">{(id) => <Input id={id} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Porción">{(id) => <Input id={id} value={d.portionLabel} onChange={(e) => setD({ ...d, portionLabel: e.target.value })} />}</Field>
          <Field label="Proteína por porción (g)">{(id) => <Input id={id} inputMode="decimal" value={d.proteinG} onChange={(e) => setD({ ...d, proteinG: e.target.value })} />}</Field>
          <Field label={`Precio pagado (${data.profile?.currency ?? "COP"})`}>{(id) => <Input id={id} inputMode="numeric" placeholder="Ej.: 18000" value={d.priceCop} onChange={(e) => setD({ ...d, priceCop: e.target.value })} />}</Field>
          <Field label="¿Cuántas porciones trae?">{(id) => <Input id={id} inputMode="decimal" placeholder="Ej.: 30 huevos" value={d.priceQty} onChange={(e) => setD({ ...d, priceQty: e.target.value })} />}</Field>
        </div>
        <Field label="Nota (dónde lo compraste, presentación)">{(id) => <Input id={id} value={d.priceNote} onChange={(e) => setD({ ...d, priceNote: e.target.value })} />}</Field>
        <p className="rounded-2xl bg-sunken px-3 py-2 text-sm">
          Costo por 25 g de proteína: <b className="num">{preview != null ? fmtCop(preview, data.profile?.currency) : "—"}</b>
        </p>
      </div>
    </Sheet>
  );
}

function useLatestMenu(uid: string) {
  const [menu, setMenu] = useState<(MenuOut & { createdAt: number; periodDays: number }) | null>(null);
  useEffect(() => {
    const q = query(collection(getDb(), "users", uid, "aiMenus"), orderBy("createdAt", "desc"), limit(1));
    return onSnapshot(q, (s) => setMenu((s.docs[0]?.data() as MenuOut & { createdAt: number; periodDays: number }) ?? null));
  }, [uid]);
  return menu;
}

function MenuCard() {
  const data = useData();
  const post = useAiPost();
  const aiOn = useAiEnabled();
  const toast = useToast();
  const saved = useLatestMenu(data.uid);
  const [budget, setBudget] = useState(data.profile?.weeklyBudget ? String(data.profile.weeklyBudget) : "");
  const [loading, setLoading] = useState<1 | 7 | null>(null);
  const [showList, setShowList] = useState(false);
  const [draft, setDraft] = useState<(MenuOut & { periodDays: number }) | null>(null);
  const currency = data.profile?.currency ?? "COP";
  const shown = draft ?? saved;

  async function generate(days: 1 | 7) {
    const b = parseNum(budget);
    if (b && b !== data.profile?.weeklyBudget) patchProfile(data.uid, { weeklyBudget: Math.round(b) });
    setLoading(days);
    try {
      setDraft(await post<MenuOut & { periodDays: number }>("/api/ai/menu", { days, budgetCop: b ? Math.round(b) : undefined }));
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card>
      <CardHeader title="Menú y lista de compras" subtitle="La IA arma un menú con tus precios y tu presupuesto" />
      <div className="flex gap-2">
        <Input aria-label="Presupuesto semanal" inputMode="numeric" placeholder={`Presupuesto semanal (${currency})`} value={budget} onChange={(e) => setBudget(e.target.value)} className="num" />
      </div>
      <div className="mt-2 flex gap-2">
        <Button variant="soft" className="flex-1" disabled={!!loading} onClick={() => generate(1)}>
          {loading === 1 && <Loader2 className="size-4 animate-spin" />} Menú de hoy
        </Button>
        <Button className="flex-1" disabled={!!loading} onClick={() => generate(7)}>
          {loading === 7 ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Semana
        </Button>
      </div>
      {draft && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-violet-soft p-3 text-sm">
          <span className="flex-1 font-semibold text-violet">Propuesta de la IA: revísala antes de guardarla.</span>
          <Button
            size="sm"
            onClick={() => {
              putDoc(data.uid, "aiMenus", newId(data.uid, "aiMenus"), { ...draft, createdAt: Date.now() });
              setDraft(null);
              toast("Menú guardado", "success");
            }}
          >
            Guardar menú
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
            Descartar
          </Button>
        </div>
      )}
      {shown ? (
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            {shown.withinBudget != null && <Badge tone={shown.withinBudget ? "primary" : "danger"}>{shown.withinBudget ? "Dentro del presupuesto" : "Se pasa del presupuesto"}</Badge>}
            {shown.totalCostCop != null && <span className="num font-semibold">Total {fmtCop(shown.totalCostCop, currency)}</span>}
          </div>
          {shown.shortfall && <p className="rounded-2xl bg-amber-soft px-3 py-2 text-amber">{shown.shortfall}</p>}
          <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
            {shown.days.map((d) => (
              <div key={d.day} className="rounded-2xl bg-sunken p-3">
                <p className="flex justify-between font-semibold">
                  {d.day} <span className="num text-muted">{fmtNum(d.proteinG, 0)} g</span>
                </p>
                <ul className="mt-1 space-y-0.5 text-muted">
                  {d.meals.map((m, i) => (
                    <li key={i}>
                      <span className="text-ink">{m.name}:</span> {m.items.map((x) => `${x.qty} ${x.food}`).join(", ")}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowList(true)}>
            <ShoppingCart className="size-4" /> Lista de compras
          </Button>
          {shown.tips.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
              {shown.tips.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          )}
          <Sheet open={showList} onClose={() => setShowList(false)} title="Lista de compras">
            <ul className="divide-y divide-line text-sm">
              {shown.shoppingList.map((s, i) => (
                <li key={i} className="flex min-h-12 items-center gap-2">
                  <span className="min-w-0 flex-1">{s.food}</span>
                  <span className="text-muted">{s.qty}</span>
                  <span className="num w-24 text-right font-semibold">{s.costCop != null ? fmtCop(s.costCop, currency) : "—"}</span>
                </li>
              ))}
            </ul>
          </Sheet>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">{!aiOn.enabled ? (aiOn.reason ?? "") : "Registra precios en el catálogo para que el menú sea exacto. Sin precios, la IA no inventa costos."}</p>
      )}
    </Card>
  );
}
