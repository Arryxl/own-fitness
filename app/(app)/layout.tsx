import type { ReactNode } from "react";
import { AppGate } from "@/components/AppGate";

// All app screens read the user's data client-side (Firestore with an offline
// cache) behind a sign-in gate, so the prerendered shell is a splash screen.
export const instant = false;

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppGate>{children}</AppGate>;
}
