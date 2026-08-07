"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Business } from "@/types/business";

export function ExploreList({
  businesses,
  searchPlaceholder,
}: {
  businesses: Business[];
  searchPlaceholder: string;
}) {
  const tStatus = useTranslations("business.status");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return businesses;
    return businesses.filter((business) => business.name.toLowerCase().includes(needle));
  }, [businesses, query]);

  return (
    <div className="flex flex-col gap-4">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={searchPlaceholder}
        className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-white outline-none focus:border-white"
      />
      <ul className="flex flex-col gap-3">
        {filtered.map((business) => (
          <li key={business.id}>
            <Link
              href={`/business/${business.id}`}
              className="flex items-center justify-between rounded-md border border-neutral-800 px-4 py-3 hover:border-neutral-600"
            >
              <span className="text-white">{business.name}</span>
              <span className="text-xs text-neutral-500">{tStatus(business.status)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
