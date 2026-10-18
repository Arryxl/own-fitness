import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "IronLog · Coach de gimnasio",
    short_name: "IronLog",
    description: "Registra tus entrenamientos, medidas y comidas; un coach de IA analiza tu progreso.",
    lang: "es-CO",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#eef5f1",
    theme_color: "#1f7d68",
    categories: ["health", "fitness", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Entrenar", url: "/entrenar", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Registrar peso", url: "/medidas", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
