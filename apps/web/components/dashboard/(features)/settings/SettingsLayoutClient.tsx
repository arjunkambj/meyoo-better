"use client";

import type React from "react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { settingsPendingAtom, setSettingsPendingAtom } from "@/store/atoms";

export default function SettingsLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pending = useAtomValue(settingsPendingAtom);
  const setPending = useSetAtom(setSettingsPendingAtom);

  // Clear pending state whenever the route changes within settings
  useEffect(() => {
    setPending(false);
  }, [pathname, setPending]);

  return (
    <div className="relative w-full h-full">
      <div className={pending ? "pointer-events-none" : ""} aria-busy={pending}>
        {children}
      </div>
      {pending && (
        <div className="fixed inset-0 z-40 bg-transparent" aria-hidden="true" />
      )}
    </div>
  );
}

