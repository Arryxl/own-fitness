// Renders the PWA icons with next/og (Satori). Run: node scripts/gen-icons.mjs
import { ImageResponse } from "next/og.js";
import { writeFileSync } from "node:fs";
import React from "react";

const h = React.createElement;

function icon(size, { maskable = false } = {}) {
  const pad = maskable ? size * 0.2 : 0; // maskable icons keep the glyph in the safe zone
  const radius = maskable ? 0 : size * 0.22;
  const u = (size - pad * 2) / 100; // glyph unit
  const bar = (w, hgt, extra = {}) =>
    h("div", { style: { width: w * u, height: hgt * u, background: "white", borderRadius: 3 * u, ...extra } });
  return h(
    "div",
    {
      style: {
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius,
        background: "linear-gradient(135deg, #2fa287 0%, #1f7d68 55%, #17654f 100%)",
      },
    },
    h(
      "div",
      { style: { display: "flex", alignItems: "center", transform: "rotate(-30deg)" } },
      bar(9, 30),
      bar(9, 46, { marginLeft: 2 * u }),
      bar(30, 9),
      bar(9, 46),
      bar(9, 30, { marginLeft: 2 * u }),
    ),
    h("div", {
      style: {
        position: "absolute",
        right: pad + 16 * u,
        bottom: pad + 16 * u,
        width: 14 * u,
        height: 14 * u,
        borderRadius: 999,
        background: "#f5937d",
      },
    }),
  );
}

async function save(name, size, opts) {
  const res = new ImageResponse(icon(size, opts), { width: size, height: size });
  writeFileSync(new URL(`../public/icons/${name}`, import.meta.url), Buffer.from(await res.arrayBuffer()));
  console.log("wrote", name);
}

await save("icon-192.png", 192);
await save("icon-512.png", 512);
await save("icon-maskable-512.png", 512, { maskable: true });
await save("apple-touch-icon.png", 180, { maskable: true });
