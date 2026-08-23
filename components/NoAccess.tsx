"use client";

import { useEffect } from "react";
import { ShieldX } from "lucide-react";

export function NoAccess() {
  useEffect(() => {
    const t = setTimeout(() => {
      window.location.href = "https://youtu.be/dQw4w9WgXcQ";
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-6 px-6 py-32 text-center">
      <div className="hero-dots" aria-hidden />
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-foreground bg-destructive text-white shadow-[4px_4px_0_0_var(--color-foreground)]">
        <ShieldX className="h-8 w-8" />
      </span>
      <h1 className="font-heading text-2xl font-extrabold tracking-tight text-foreground">
        您無權使用該系統
      </h1>
      <p className="font-mono text-sm font-bold text-muted-foreground">
        3 秒後將自動跳轉…
      </p>
    </div>
  );
}
