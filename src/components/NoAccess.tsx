"use client";

import { useEffect } from "react";
import { ShieldX } from "lucide-react";

export function NoAccess({ portalUrl }: { portalUrl: string }) {
  useEffect(() => {
    const t = setTimeout(() => {
      window.location.href = portalUrl;
    }, 3000);
    return () => clearTimeout(t);
  }, [portalUrl]);

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-6 px-6 py-32 text-center">
      <div className="hero-dots" aria-hidden />
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-foreground bg-destructive text-white shadow-[4px_4px_0_0_var(--color-foreground)]">
        <ShieldX className="h-8 w-8" />
      </span>
      <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
        您無權使用該系統
      </h1>
      <p className="font-mono text-sm font-bold text-muted-foreground">
        查無您的課表資料，3 秒後將返回門戶大廳。
      </p>
      <a
        href={portalUrl}
        className="rounded-xl border-2 border-foreground bg-card px-4 py-2 text-sm font-bold text-foreground shadow-[3px_3px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-foreground)]"
      >
        立即返回
      </a>
    </div>
  );
}
