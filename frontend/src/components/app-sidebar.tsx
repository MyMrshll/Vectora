"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { name: "System Overview", icon: "memory", href: "/" },
  { name: "Vector Database", icon: "hub", href: "/documents" },
  { name: "Knowledge Graph", icon: "account_tree", href: "/playground" },
  { name: "Ingestion Pipeline", icon: "cloud_sync", href: "/chunks" },
  { name: "Audit Logs", icon: "history", href: "/logs" },
  { name: "Models", icon: "settings", href: "/models" },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col h-screen py-8 px-4 w-[280px] fixed left-0 top-0 bg-surface-container-low border-r border-outline-variant z-40">
      <div className="mb-10 px-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center border border-secondary/30">
            <span className="material-symbols-outlined text-secondary">memory</span>
          </div>
          <div>
            <h3 className="font-data-mono text-secondary font-bold text-[14px]">VECTORA_OS_01</h3>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-tighter">Cluster: US-EAST-1</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={
                isActive
                  ? "bg-secondary/10 text-secondary border-r-2 border-secondary font-bold flex items-center gap-4 px-4 py-3 transition-all"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest flex items-center gap-4 px-4 py-3 transition-colors"
              }
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="font-data-mono text-body-md">{item.name}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-4 py-4 border-t border-outline-variant">
        <span className="text-[10px] font-data-mono text-on-surface-variant/50">v2.4.0-stable</span>
      </div>
    </aside>
  );
}
