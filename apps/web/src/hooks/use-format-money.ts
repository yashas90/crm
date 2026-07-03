"use client";

import { useOrg } from "@/hooks/use-org";
import { formatMoneyFull } from "@/lib/format-currency";
import { resolveOrgFormatting } from "@/lib/org-settings";

export function useFormatMoney() {
  const org = useOrg();
  const formatting = resolveOrgFormatting(org.data?.settings);

  return {
    formatMoney: (value: number) =>
      formatMoneyFull(value, {
        locale: formatting.locale,
        currency: formatting.currency,
      }),
    formatting,
    isLoading: org.isLoading,
  };
}
