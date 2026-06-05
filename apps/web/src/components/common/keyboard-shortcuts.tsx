"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function KeyboardShortcuts() {
  const pathname = usePathname();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "/") {
        const search = document.getElementById("global-search") as HTMLInputElement | null;
        if (search) {
          event.preventDefault();
          search.focus();
        }
        return;
      }

      if ((event.key === "n" || event.key === "N") && pathname === "/leads") {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("propninja:open-new-lead"));
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pathname]);

  return null;
}
