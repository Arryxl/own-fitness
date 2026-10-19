"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { SECONDARY } from "@/components/AppShell";
import { useAuth } from "@/components/providers/AuthProvider";
import { UserCog } from "lucide-react";
import { IconTile, PageHeader } from "@/components/ui";

export default function MorePage() {
  const { isAdmin } = useAuth();
  const items = isAdmin ? [...SECONDARY, { href: "/admin", label: "Administración", icon: UserCog, desc: "Usuarios, uso de IA y cuota" }] : SECONDARY;
  return (
    <div className="animate-rise">
      <PageHeader title="Más" />
      <ul className="glass divide-y divide-line overflow-hidden rounded-[var(--radius-card)]">
        {items.map(({ href, label, desc, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="flex min-h-16 items-center gap-3 px-4 py-3 transition hover:bg-sunken">
              <IconTile>
                <Icon className="size-5" />
              </IconTile>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{label}</span>
                <span className="block text-sm text-muted">{desc}</span>
              </span>
              <ChevronRight className="size-5 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
