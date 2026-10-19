# IronLog · gimnasio + coach de IA (multiusuario)

PWA para registrar entrenamientos, medidas, pasos y comidas, con una **biblioteca de 10 rutinas reconocidas** (H1-H6 crecer, F1-F2 fuerza, D1-D2 definir) adaptadas a entrenar sin compañero, y un **coach de IA (Gemini)** que analiza los datos reales de cada usuario y propone cambios que el usuario aprueba.

Next.js 16 (App Router, TypeScript estricto) · Tailwind v4 · Firebase Auth + Firestore (plan Spark) · Gemini API (Interactions API) · pensado para Vercel Hobby.

## Funciones

- **Cuentas**: email/contraseña con verificación de correo, Google, recuperar contraseña, cerrar sesión y **borrar cuenta con todos los datos**.
- **Onboarding** (se puede retomar y editar): alias, fecha de nacimiento (**solo mayores de 18**), sexo, estatura, peso, objetivo, nivel, días disponibles, equipo del gimnasio, lesiones, país/moneda/presupuesto, restricciones alimentarias, unidades. Aviso de salud y política de privacidad con aceptación explícita; **consentimiento de IA aparte y desactivable**.
- **Rutinas**: la app recomienda 1-2 plantillas con `recommendationRules` (sin que la IA invente rutinas), advierte nivel/sábado/días y deja decidir. «Usar esta rutina» crea una **copia editable** del plan (calendarios clásico/con martes/con jueves, rotación A/B de StrongLifts, cardio, superseries y refuerzos opcionales).
- **Entrenar**: series en lb o kg por ejercicio, RIR, calentamiento, temporizador, «la última vez», doble progresión (o las reglas propias del programa), «No puedo hacer este» con cadena de alternativas. **Funciona sin señal**.
- **Progreso**: peso (promedio 7 d), medidas, e1RM por ejercicio, volumen semanal por músculo, asistencia.
- **Nutrición**: metas en **rangos** (Mifflin-St Jeor + objetivo; superávit pequeño para crecer, déficit moderado para definir, con umbral mínimo de seguridad), proteína 1,6-2,2 g/kg, catálogo de alimentos baratos por país con tus precios (orden por costo de 25 g de proteína), estimación de comidas y menús con IA **que apruebas antes de guardar**.
- **Coach IA**: chat con herramientas que leen solo los datos del usuario autenticado, informes semanales, memoria (RAG), propuestas de cambio con aprobación.
- **Admin**: número de usuarios, uso de IA, cuota de Firestore con alerta al 70 % y bloquear/desbloquear cuentas. **No puede leer entrenamientos, medidas ni chats.**

## Catálogo de rutinas (v3)

36 plantillas en `data/seed/rutinas_seed.json`, generadas por `scripts/catalog/build-v3.mjs` sobre la biblioteca v2:

| Grupo | Plantillas |
| --- | --- |
| Hipertrofia | H1-H6 (biblioteca v2), PPL de Metallicadpa 6 y 3 días, PPL de Coolcicada, PHUL, PHAT, GBR de Lyle McDonald, bro split, Fierce 5 |
| Fuerza | F1-F2 (v2), Basic Beginner Routine, GSLP, Starting Strength, 5/3/1 for Beginners, Ivysaur 4-4-8, Texas Method, Madcow, nSuns 5 días, 5/3/1 BBB |
| Definición | D1-D2 (v2) |
| Acondicionamiento | Couch to 5K (NHS), 4×4 noruego, 10×1 de Gibala, sprints tipo Wingate |
| Salud y casos especiales | OMS fuerza + cardio, calistenia (Recommended Routine), mayores / regreso, minimalista 2 días, casa con mancuernas y bandas |

Cada plantilla lleva `source` con su nivel de verificación: **primaria** (autor o página oficial), **comunitaria** (transcripción contrastada: Liftosaur, Lift Vault, wiki de r/Fitness), **síntesis** (IronLog a partir de guías como ACSM 2026, OMS 2020 o NSCA 2019) o **adaptación** (biblioteca v2). Los programas de marca se describen como estructura pública, sin copiar material de pago. Se dejaron fuera, por no poder verificarlos: Candito, Sheiko, PPLUL, las variantes de nSuns de 4 y 6 días, los programas de Nippard, Strong Curves B/C y las tablas de RP.

`lib/analytics/validate.ts` revisa cada plantilla contra la evidencia: volumen semanal (≥4 series como dosis mínima, ~10 para hipertrofia, >30 se marca), ~11 series por sesión, frecuencia, deltoide posterior, abdomen y cargas pesadas en fuerza. Son notas, no bloqueos.

## Arquitectura de datos

```
catalog/meta                 versión, objetivos, músculos, recommendationRules   (solo lectura)
catalog/exercises            { items: [93 ejercicios] }                          (solo lectura)
catalog/programTemplates     { items: [10 plantillas] }                          (solo lectura)
catalog/addOns               { items: [3 refuerzos] }                            (solo lectura)
catalog/foods_CO | foods_DEFAULT  alimentos semilla por país                     (solo lectura)
users/{uid}                  perfil
users/{uid}/exerciseOverrides  solo lo que el usuario cambió (o ejercicios propios)
users/{uid}/plans, workouts, bodyMetrics, activity, meals, foods, personalRecords, weeklyStats
users/{uid}/aiChats/*/messages, aiReports, aiMenus, memories, proposals
users/{uid}/aiUsage/{día}    contadores de IA (solo servidor)
system/aiUsage-{día}, system/events-*   tope global y eventos mínimos (solo servidor)
```

El catálogo vive en **documentos agregados**: cargarlo cuesta ~5 lecturas por usuario (y queda en caché offline), en vez de copiar 93 ejercicios a cada cuenta.

## Puesta en marcha local

```bash
npm install
cp .env.example .env.local     # completa las variables (ver abajo)
npm run seed                   # sube el catálogo global, publica firestore.rules y da el rol admin
npm run dev                    # http://localhost:3000
```

### Variables de entorno

| Variable | Dónde | Para qué |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | cliente | Config web de Firebase (pública por diseño; la protegen las reglas) |
| `FIREBASE_SERVICE_ACCOUNT` | servidor | JSON de la cuenta de servicio en base64 (Admin SDK). **Nunca** en git |
| `GEMINI_API_KEY` | servidor | Clave de Gemini. Nunca llega al navegador |
| `GEMINI_MODEL`, `GEMINI_MODEL_FALLBACK`, `GEMINI_EMBEDDING_MODEL` | servidor | IDs de modelo (verificados el 18-oct-2026) |
| `GEMINI_TIER` | servidor | `free` exige el consentimiento de IA de cada usuario; `paid` lo hace opcional |
| `AI_DAILY_MESSAGES`, `AI_DAILY_TOKENS` | servidor | Cuota diaria por usuario |
| `AI_GLOBAL_DAILY_LIMIT` | servidor | Tope diario de consultas de IA de toda la app |
| `ADMIN_EMAILS` | servidor | Correos con rol admin (`npm run seed` les pone el custom claim) |

### Firebase (ya configurado para el proyecto `ironlog-fitness-6cbc9`)
1. Proyecto en plan **Spark**; Authentication con **Correo/contraseña** y **Google**; Firestore en `us-east1` (modo producción).
2. App web registrada → variables `NEXT_PUBLIC_FIREBASE_*`.
3. Clave de cuenta de servicio → `FIREBASE_SERVICE_ACCOUNT` (base64).
4. `npm run seed` publica `firestore.rules` y el catálogo. Después de que un correo de `ADMIN_EMAILS` se registre, vuelve a ejecutar `npm run seed` y cierra/abre sesión para que el rol admin aplique.
5. Para que el panel admin muestre el uso de Firestore, da a la cuenta de servicio el rol **Monitoring Viewer** en Google Cloud IAM.

## Pruebas

```bash
npm run test          # unitarias (analytics, plantillas vs weeklyVolume, recomendaciones, energía, cuotas, seed)
npm run test:rules    # reglas de Firestore en el emulador: aislamiento entre usuarios, catálogo, admin sin acceso
npm run test:e2e      # Playwright con emuladores: registro → verificación → onboarding → rutina → entreno sin señal → informe IA → cuota → borrar cuenta
npm run check         # tipos + lint + unitarias + build
```

Los emuladores necesitan Java: el script usa un JRE portable en `.tools/` (ignorado por git) si existe, o el Java del sistema. Las pruebas E2E usan una IA simulada (`AI_FAKE=1`), que nunca se activa en producción.

## Despliegue (cuando toque)
1. Importa el repo en Vercel y añade las variables de entorno (sin `NEXT_PUBLIC_USE_EMULATORS` ni `AI_FAKE`).
2. `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` = tu dominio de Vercel (el `next.config.ts` reenvía `/__/auth/*` a Firebase para Safari/iOS) y añádelo en Firebase → Authentication → Dominios autorizados.
3. Personaliza las plantillas de correo de Firebase (verificación y contraseña) en español.

### Límites gratuitos y cuándo pagar
- **Firestore Spark**: 1 GiB, 50 000 lecturas, 20 000 escrituras y 20 000 borrados al día **para todo el proyecto**. Con persistencia offline y catálogo agregado, un usuario activo hace del orden de cientos de lecturas al día: piensa en **decenas** de usuarios activos diarios, no miles. El panel admin avisa al 70 %. Pasar a **Blaze** (pago por uso) cuando la alerta salte con frecuencia.
- **Vercel Hobby**: solo **uso personal no comercial**. Si la app cobra, tiene anuncios o se ofrece como servicio de una empresa, hace falta **Pro**. La documentación vigente (verificada el 18-oct-2026) permite funciones de hasta 300 s en Hobby; la app corta cada llamada de IA a los 50 s igualmente.
- **Gemini capa gratuita**: límites por proyecto (ver AI Studio) y **uso del contenido para mejorar productos de Google**. Para usuarios reales conviene la capa de pago (`GEMINI_TIER=paid`), que además elimina ese uso de datos.
- **Abuso**: hay límite por usuario y por IP en los endpoints de IA y Firebase Auth protege el registro. Antes de abrir al público, activa **Firebase App Check** con reCAPTCHA (gratis dentro de su cuota) y la protección contra enumeración de correos.

## Privacidad
Política completa en `/privacidad`. Resumen: cada usuario solo puede leer/escribir `users/{su uid}/**`; el admin solo ve metadatos de cuentas y contadores agregados; la IA recibe métricas sin nombre, correo ni fecha de nacimiento, y solo con consentimiento; exportar (JSON/CSV) y borrar la cuenta están en Ajustes; los logs del servidor no incluyen datos de salud.

## Decisiones legales y comerciales pendientes (no técnicas)
1. **Responsable del tratamiento**: quién es (persona o empresa), datos de contacto y un correo para solicitudes de privacidad. Colombia: Ley 1581 de 2012 (datos sensibles de salud requieren autorización expresa) y registro en el RNBD de la SIC si aplica.
2. **Términos y condiciones** (uso, responsabilidad, edad mínima, suspensión de cuentas) revisados por un abogado.
3. **Transferencia internacional de datos** (servidores de Google/Vercel en EE. UU.) y su mención en la política.
4. **Modelo comercial**: si habrá cobro, publicidad o empresa detrás → Vercel Pro, Firebase Blaze y Gemini de pago.
5. **Retención**: plazo de conservación de cuentas inactivas y de copias.
6. **Revisión profesional** del aviso de salud y de los textos de nutrición (nutricionista/médico deportivo).
7. Política para **menores**: hoy se bloquea por fecha de nacimiento declarada; decidir si se necesita verificación adicional.
8. Plan de respuesta ante **incidentes de seguridad** y notificación a usuarios.

## Fuentes de las reglas de coaching
Volumen: Baz-Valle 2022; Schoenfeld 2017. Frecuencia: Schoenfeld 2016. Cercanía al fallo: Refalo 2022. Proteína: Morton 2018. Energía: Mifflin-St Jeor 1990. Creatina: ISSN (Kreider 2017). Programas: StrongLifts 5×5, GZCLP, PHUL, PPL, Arnold split (ver `data/seed/rutinas_seed.json`). Son heurísticas, no consejo médico.
