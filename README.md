# IronLog · gimnasio + coach de IA

App personal (PWA) para registrar entrenamientos, medidas, pasos y comidas, con un **coach de IA (Gemini)** que analiza los datos reales y propone ajustes que el usuario aprueba.

Next.js 16 (App Router, TypeScript estricto) · Tailwind v4 · Firebase (Auth + Firestore, plan Spark) · Gemini API (Interactions API) · Vercel Hobby. Costo de hospedaje: 0.

## Qué hace

- **Hoy**: sesión del día según el plan (L-M-V + día flotante martes/jueves activable por semana), progreso semanal, acciones rápidas.
- **Entrenar**: series con reps, peso en **lb o kg por ejercicio** (se guarda en kg; 1 lb = 0,45359237 kg), RIR, calentamiento, copiar serie, temporizador de descanso, «la última vez» y sugerencia de **doble progresión**. Botón **«No puedo hacer este»** con cadena ordenada de alternativas editables. **Funciona sin señal** y se sincroniza al volver.
- **Progreso**: peso con promedio móvil de 7 días y tendencia, cintura y medidas, e1RM por ejercicio concreto, volumen semanal por músculo vs 12-20 series, calendario de asistencia.
- **Nutrición**: meta 1,6-2,2 g/kg de proteína, registro manual / por catálogo / **estimado por IA con confirmación**, catálogo de alimentos baratos con **COP por 25 g de proteína** (precios que tú escribes), menú y lista de compras según presupuesto.
- **Coach IA**: chat con streaming que consulta tus datos con herramientas, informe semanal estructurado (veredicto + máx. 3 acciones), propuestas de cambio al plan que **no se aplican sin tu aprobación**, memoria con búsqueda semántica (RAG).
- **Respaldo**: exportar JSON y CSV, importar JSON.

## Puesta en marcha

### 1. Requisitos
Node 20+ (probado con 26) y npm.

```bash
npm install
cp .env.example .env.local
```

### 2. Probar sin Firebase (modo demo)
En `.env.local` pon `NEXT_PUBLIC_DEMO_MODE=1` y ejecuta `npm run dev`. La app usa datos de ejemplo guardados en el navegador. La IA no funciona en demo. El modo demo nunca se activa en builds de producción.

### 3. Crear el proyecto de Firebase (plan Spark, sin tarjeta)
1. En <https://console.firebase.google.com> crea un proyecto.
2. **Authentication → Método de acceso → Google**: habilítalo.
3. **Firestore Database → Crear base de datos** (modo producción, región cercana, p. ej. `southamerica-east1` o `us-east1`).
4. **Configuración del proyecto → Tus apps → Web (`</>`)**: registra la app y copia la config en las variables `NEXT_PUBLIC_FIREBASE_*` de `.env.local`.
5. **Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada**. Codifícala en base64 y guárdala en `FIREBASE_SERVICE_ACCOUNT` (nunca subas el JSON al repo):
   - PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("clave.json"))`
   - Bash: `base64 -w0 clave.json`
6. `ALLOWED_EMAIL`: tu correo de Google (puede ser una lista separada por comas).
7. Reglas: `npm run rules:build` genera `firestore.rules` desde `firestore.rules.tmpl` con tu email (el archivo generado está en `.gitignore`). Publícalas con `npx firebase-tools deploy --only firestore:rules --project <id>` o pégalas en la consola (Firestore → Reglas).

### 4. Gemini
Crea una clave en <https://aistudio.google.com/apikey> y ponla en `GEMINI_API_KEY`. Los IDs de modelo están en variables de entorno (`GEMINI_MODEL=gemini-3.8-flash`, `GEMINI_MODEL_FALLBACK=gemini-3.5-flash-lite`, `GEMINI_EMBEDDING_MODEL=gemini-embedding-2`), verificados contra la documentación y la lista de modelos el 18-oct-2026.

### 5. Desarrollo
```bash
npm run dev          # http://localhost:3000
npm run check        # tipos + lint + pruebas + build
npm run test:e2e     # Playwright (levanta un servidor en modo demo)
npm run test:rules   # reglas de Firestore con el emulador (requiere Java)
```

## Despliegue en Vercel (Hobby)
1. Importa el repositorio en <https://vercel.com/new>.
2. En **Settings → Environment Variables** añade todas las variables de `.env.example` (sin `NEXT_PUBLIC_DEMO_MODE`). Pon `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` = tu dominio de Vercel (p. ej. `ironlog-xxx.vercel.app`): `next.config.ts` reenvía `/__/auth/*` a Firebase para que el inicio de sesión funcione en Safari/iOS.
3. En Firebase → Authentication → Configuración → **Dominios autorizados**, añade ese dominio.
4. Despliega.

Límites verificados el 18-oct-2026: Vercel Hobby es para uso personal no comercial; las funciones (Fluid compute) pueden durar hasta 300 s, pero la app corta cada llamada de IA a los 50 s por diseño. Firestore Spark: 1 GiB, 50 000 lecturas, 20 000 escrituras y 20 000 borrados al día, 10 GiB/mes de salida; se reinicia a medianoche del Pacífico.

## Instalar en el celular
- **Android (Chrome)**: abre la URL → menú ⋮ → *Instalar app*.
- **iPhone (Safari)**: abre la URL → botón **Compartir** → **Añadir a pantalla de inicio**.
- **PC (Chrome/Edge)**: ícono de instalar en la barra de direcciones.

Inicia sesión una vez con conexión; después puedes registrar entrenamientos sin señal.

## Respaldo
**Ajustes → Respaldo de datos**: *Exportar JSON* (respaldo completo, re-importable), *Exportar CSV* (una fila por serie, medida, comida y día de actividad, para Excel/Sheets) e *Importar respaldo* (sobrescribe por id, no borra nada). Las memorias del coach vuelven como pendientes para recalcular sus embeddings.

## Privacidad
- Solo tu cuenta (`ALLOWED_EMAIL`, email verificado) puede leer o escribir `users/{uid}/**`; lo exigen las reglas de Firestore y cada endpoint de IA verifica el token con Firebase Admin.
- La clave de Gemini y la cuenta de servicio solo existen en el servidor.
- **Aviso — capa gratuita de Gemini**: según la página de precios de Google, en la capa gratuita **el contenido enviado se usa para mejorar los productos de Google**. La app envía solo métricas (series, cargas, medidas, comidas, notas), nunca tu nombre ni tu email. Si no quieres esto, no uses las funciones de IA o pasa a un plan de pago.
- Interacciones de Gemini: en capa gratuita se retienen 1 día; el historial de chat vive en tu Firestore.

## Arquitectura

```
app/(app)/*            pantallas (componentes cliente; leen Firestore con caché offline)
app/api/ai/*           chat (streaming + herramientas), report, meal-estimate, menu, substitute, memory
lib/analytics/*        funciones puras: unidades, fechas, e1RM, doble progresión, volumen, peso, asistencia, nutrición (con pruebas)
lib/ai/*               cliente Gemini, herramientas, esquemas Zod, memoria RAG, prompt versionado (prompts/coach.v1.ts)
lib/data/*             datos semilla: ejercicios + cadenas de alternativas, planes, alimentos, marcas iniciales
lib/firebase/*         SDK cliente (persistentLocalCache multi-pestaña) y Admin
public/sw.js           service worker: shell offline (los datos offline los maneja Firestore)
firestore.rules.tmpl   plantilla de reglas (el email se inyecta al generar)
```

Decisiones:
- **Interactions API** (`ai.interactions.create`) con `previous_interaction_id` para encadenar herramientas dentro de una petición; `system_instruction`, `tools` y `generation_config` se repiten en cada llamada.
- **Herramientas** de solo lectura validadas con Zod y filtradas por el `uid` verificado. `propose_plan_change` y `save_memory` solo crean elementos *pendientes*.
- **Informe semanal**: el servidor ejecuta las mismas herramientas de forma determinista y pide JSON con esquema (`response_format`), validado con Zod; con menos de 2 semanas de datos el veredicto es `insufficient_data`. Se genera solo al abrir la app si hay una semana cerrada sin informe (sin cron).
- **RAG**: `gemini-embedding-2` a 768 dimensiones (sin `task_type`; el propósito va en el prefijo del texto), guardado con `FieldValue.vector`, similitud coseno en servidor sobre las últimas 500 memorias.
- **Errores de IA**: reintento exponencial en 429/5xx, modelo de respaldo, límite propio por minuto y por día (`AI_DAILY_LIMIT`), mensajes amables; nunca se pierde un dato por un fallo de IA.
- **weeklyStats** se calcula en el cliente al guardar una sesión (funciona sin señal); las herramientas de IA recalculan desde los datos crudos.

## Mejoras futuras
- Fotos de progreso (Firebase Storage requiere plan de pago en proyectos nuevos; pendiente de evaluar).
- Base de conocimiento con artículos/PDF usando **File Search** de Gemini (`fileSearchStores` + `gemini-embedding-2`).
- Búsqueda vectorial nativa con `findNearest` de Firestore si las memorias crecen mucho.

## Fuentes de las reglas de coaching
Volumen: Baz-Valle 2022; Schoenfeld 2017. Frecuencia: Schoenfeld 2016. Cercanía al fallo: Refalo 2022. Grasa abdominal: Brobakken 2023. Proteína: Morton 2018 (BJSM). Creatina: ISSN (Kreider 2017). Son heurísticas, no consejo médico.
