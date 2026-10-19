import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacidad" };

const UPDATED = "18 de octubre de 2026";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <Link href="/" className="text-sm font-semibold text-primary">
        ← Volver
      </Link>
      <article className="glass mt-4 space-y-5 rounded-[2rem] p-6 text-sm leading-relaxed sm:p-8">
        <header>
          <h1 className="text-3xl font-extrabold tracking-tight">Política de privacidad</h1>
          <p className="mt-1 text-muted">Última actualización: {UPDATED}. Versión de prueba previa al lanzamiento.</p>
        </header>

        <section>
          <h2 className="text-lg font-bold">Qué datos guardamos</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <b>Cuenta:</b> tu correo y, si usas Google, el identificador de tu cuenta de Google (Firebase Authentication).
            </li>
            <li>
              <b>Perfil:</b> alias, fecha de nacimiento, sexo, estatura, peso, objetivo, nivel, días de entrenamiento, equipo disponible, lesiones o molestias que declares, país, moneda, presupuesto y restricciones alimentarias.
            </li>
            <li>
              <b>Actividad:</b> planes, entrenamientos (series, cargas, notas), medidas corporales, pasos, comidas y precios que registres.
            </li>
            <li>
              <b>Coach de IA (si lo activas):</b> conversaciones, informes, propuestas y notas que decidas guardar.
            </li>
            <li>
              <b>Uso técnico:</b> contadores de consultas a la IA por día y un registro mínimo de eventos (por ejemplo, «cuenta borrada»), sin datos de salud.
            </li>
          </ul>
          <p className="mt-2">Algunos de estos datos (peso, medidas, lesiones) son datos relacionados con la salud: los tratamos como sensibles.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold">Para qué los usamos</h2>
          <p className="mt-2">
            Únicamente para darte el servicio: mostrar tu progreso, recomendarte rutinas de la biblioteca, calcular metas estimadas y, si lo aceptas, que el coach de IA analice tus datos. No vendemos datos, no mostramos publicidad y no los usamos para perfiles comerciales.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">Con quién se comparten</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <b>Google Firebase</b> (Authentication y Cloud Firestore) almacena tu cuenta y tus datos.
            </li>
            <li>
              <b>Google Gemini API</b>, solo si activas el coach de IA. Se envían métricas (series, cargas, peso, medidas, comidas, notas, edad, sexo, objetivo, lesiones declaradas). <b>Nunca</b> se envían tu nombre, alias, correo ni fecha de nacimiento.
            </li>
            <li>
              <b>Capa gratuita de Gemini:</b> mientras la app use la capa gratuita, <b>Google puede usar el contenido enviado para mejorar sus productos</b>. Por eso el coach requiere tu consentimiento expreso y puedes desactivarlo en cualquier momento en Ajustes.
            </li>
            <li>El hospedaje de la app (Vercel) procesa las solicitudes técnicas necesarias para servirla.</li>
          </ul>
          <p className="mt-2">El administrador de la app solo ve métricas agregadas y datos de la cuenta (correo, fechas de alta y acceso, si está bloqueada). No puede ver tus entrenamientos, medidas, comidas ni chats.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold">Cuánto tiempo se conservan</h2>
          <p className="mt-2">
            Mientras tengas cuenta. Si la borras, eliminamos de inmediato tu cuenta y todos tus datos de Firestore. Las interacciones con Gemini se retienen en los sistemas de Google según sus términos (en la capa gratuita, alrededor de un día para el almacenamiento de la interacción, además del uso para mejora de productos descrito arriba).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">Tus derechos y cómo ejercerlos</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <b>Acceder y llevarte tus datos:</b> Ajustes → Exportar JSON o CSV.
            </li>
            <li>
              <b>Corregirlos:</b> edita tu perfil y tus registros en cualquier momento.
            </li>
            <li>
              <b>Retirar el consentimiento de IA:</b> Ajustes → Coach de IA.
            </li>
            <li>
              <b>Borrarlos:</b> Ajustes → Borrar mi cuenta y todos mis datos.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold">Salud</h2>
          <p className="mt-2">
            IronLog no es un dispositivo médico ni sustituye a un profesional de la salud. Las metas de calorías y proteína son rangos estimados con fórmulas estándar. Ante dolor, mareo, dolor en el pecho, síntomas de un trastorno de la conducta alimentaria o cualquier condición de salud, consulta a un profesional. Solo para mayores de 18 años.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">Seguridad</h2>
          <p className="mt-2">
            Cada cuenta solo puede leer y escribir sus propios datos (reglas de seguridad de Firestore). La clave de la IA y las credenciales de servidor nunca llegan al navegador. Ningún sistema es infalible: usa una contraseña única.
          </p>
        </section>
      </article>
    </main>
  );
}
