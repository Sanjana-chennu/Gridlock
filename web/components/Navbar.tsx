"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: "" },
  { href: "/tactical", label: "Tactical Ops", icon: "" },
  { href: "/structural", label: "Structural Policy", icon: "" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 navbar-glass">
      <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/25 group-hover:shadow-blue-500/40 transition-shadow">
            V
          </div>
          <div>
            <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              VYUHA
            </span>
            <span className="hidden sm:inline text-[10px] text-slate-500 uppercase tracking-[0.15em] ml-2">
              BTP Intelligence
            </span>
          </div>
        </Link>

        {/* Nav Links */}
        <div className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  ${
                    isActive
                      ? "bg-white/10 text-white shadow-inner"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }
                `}
              >
                <span className="mr-1.5">{item.icon}</span>
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            );
          })}

          {/* Status Indicator */}
          <div className="ml-4 pl-4 border-l border-white/10 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-500 hidden lg:inline">
              API Connected
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}
