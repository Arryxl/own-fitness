// Seed catalog of cheap foods in Colombia (section 9.3). Protein values are the
// approximations given in the spec; null means "complete it yourself".
// No prices are seeded: the user enters what they actually pay, in COP.
import type { Food } from "@/lib/types";

function food(id: string, name: string, portionLabel: string, proteinG: number | null, portionGrams: number | null = null, notes = ""): Food {
  return { id, name, portionLabel, portionGrams, proteinG, kcal: null, priceCop: null, priceQty: null, priceNote: "", notes };
}

export const SEED_FOODS: Food[] = [
  food("egg", "Huevo", "1 unidad", 6),
  food("lentils", "Lentejas cocidas", "1 taza", 18),
  food("beans", "Fríjoles cocidos", "1 taza", 15),
  food("chickpeas", "Garbanzos cocidos", "1 taza", 14),
  food("chicken_thigh", "Muslo/contramuslo/pernil de pollo", "100 g", 26, 100, "≈ 25-27 g por 100 g"),
  food("chicken_breast", "Pechuga de pollo", "100 g", 31, 100),
  food("chicken_liver", "Hígado y menudencias de pollo", "100 g", null, 100, "Opción muy económica"),
  food("tuna", "Atún en lata", "1 lata", null),
  food("sardines", "Sardinas en lata", "1 lata", null),
  food("milk", "Leche", "1 vaso", 8),
  food("cuajada", "Cuajada / queso campesino", "100 g", null, 100),
  food("yogurt", "Yogur", "1 porción", null),
  food("oats", "Avena", "1/2 taza", null),
  food("rice", "Arroz", "1 taza cocido", null),
  food("potato", "Papa", "1 mediana", null),
  food("plantain", "Plátano", "1 unidad", null),
  food("yuca", "Yuca", "1 porción", null),
  food("arepa", "Arepa", "1 unidad", null),
  food("bread", "Pan", "1 unidad", null),
  food("peanuts", "Maní", "30 g", null, 30),
  food("tvp", "Soya texturizada (si la encuentras)", "30 g seca", null, 30),
];
