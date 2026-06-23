"use client";

import { Input } from "@propninja/ui/input";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/leads?search=${encodeURIComponent(trimmed)}`);
    setQuery("");
  }

  return (
    <form onSubmit={handleSubmit} className="relative hidden lg:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search leads…"
        aria-label="Search leads"
        className="h-9 w-56 border-2 border-black pl-9 shadow-[2px_2px_0_0_#000] md:w-64"
      />
    </form>
  );
}
