# Diseño de IronLog

Referencia: una lámina de seis pantallas de una app de fitness (onboarding, panel, entrenamientos, detalle, actividad y nutrición).

## Qué se replicó

| Elemento de la referencia | En IronLog |
|---|---|
| Fondo con degradado menta → durazno | Dos gradientes radiales fijos sobre `--bg` (`globals.css`) |
| Tarjetas de vidrio esmerilado, esquinas de ~24 px, sombra suave | Clase `.glass` (blur 18 px + borde translúcido) y `--radius-card: 1.5rem` |
| Verde azulado como color principal (botones, anillo, barra activa) | `--primary` |
| Coral para acciones de comida y gráficos de calorías | `--accent` (registrar comida, proteína, puntos de peso) |
| Íconos dentro de cuadrados redondeados de colores suaves | `IconTile` con tonos primary/violet/accent/amber |
| Anillo de progreso «Today's Progress» con leyenda de colores | Tarjeta «Progreso de la semana» (sesiones, proteína, pasos, racha) |
| Barras semanales con el día actual resaltado | «Actividad semanal» (series por día; el día de hoy en sólido, días planeados en línea punteada) |
| Pestañas tipo píldora (Day/Week/Month) | Componente `Segmented` |
| Navegación inferior flotante con el ítem activo resaltado | Barra inferior de 5 ítems (Hoy · Entrenar · Progreso · Coach · Más) |
| Lista de comidas con círculo de check | «Comidas de hoy» |
| Botón CTA grande y redondeado con flecha | Botones `size="lg"`, login «Entrar con Google» |
| Tipografía geométrica con títulos gruesos y una palabra en color | Plus Jakarta Sans; «Tu **recomposición** empieza aquí» |

## Qué se mejoró

- **Contraste AA**: el verde y el coral de la referencia no alcanzan 4.5:1 con texto blanco. Se oscurecieron para texto/botones (`#1f7d68` ≈ 5:1; coral de botón `#b84a33`) y se dejaron los tonos claros solo para rellenos y gráficos. Grises de texto secundario ≥ 4.5:1.
- **Modo oscuro cuidado**: paleta propia (no inversión), respeta `prefers-color-scheme` y se puede forzar en Ajustes sin destello (script en `<head>`).
- **Uso en el gimnasio**: objetivos táctiles ≥ 48 px, teclado numérico (`inputMode`), botón de serie hecha grande, temporizador flotante con vibración, una tarjeta de ejercicio abierta a la vez que avanza sola.
- **Estados vacíos útiles** (qué hacer y por qué) y **esqueletos/splash** de carga.
- **Indicador de conexión**: «Sin conexión · se guarda en el teléfono» y «Sincronizando…» con escrituras pendientes.
- **Escritorio**: barra lateral, rejillas de 2-3 columnas y gráficos más grandes con el mismo código.
- **Accesibilidad**: enlace «Saltar al contenido», `aria-label` en todos los controles de ícono, `role="tablist/radiogroup/progressbar/timer"`, diálogos nativos `<dialog>` con foco atrapado y cierre con Esc, foco visible de 3 px.
- **Movimiento**: animaciones cortas de entrada y transición de barras; todo se desactiva con `prefers-reduced-motion`.
- **Fechas y números en español de Colombia** (`es-CO`), coma decimal aceptada en los campos.

## Tokens

Definidos como variables CSS en `app/globals.css` y expuestos a Tailwind con `@theme inline` (`bg-primary`, `text-muted`, `bg-sunken`, etc.). Componentes base en `components/ui.tsx`.
