import { useMemo } from "react";
import { usePublicGroups } from "@/hooks/useGroupsData";
import { STRIPE_FEE_PER_PERSON } from "@/lib/serviceConstants";
import { resolveService } from "@/lib/soloPrices";

export const HIDDEN_SERVICES = new Set([
  "xbox game pass",
  "xbox game pass ultimate",
  "canva pro",
  "canva",
]);

export type SavingsService = {
  key: string;
  name: string;
  solo: number; // prezzo del piano SINGOLO (quello che pagheresti da solo)
  soloPlan: string; // nome del piano singolo
  perPerson: number; // quota reale su DivideIt (fee inclusa)
  seats: number;
  saving: number; // risparmio mensile
};

export function euro(n: number) {
  return `€${n.toFixed(2)}`;
}

export function useSavingsServices() {
  const { data: rawGroups = [], isLoading } = usePublicGroups();

  const groups = useMemo(
    () =>
      (rawGroups as any[]).filter(
        (g) =>
          !HIDDEN_SERVICES.has((g.service_type || "").toLowerCase()) &&
          !HIDDEN_SERVICES.has((g.service_name || "").toLowerCase()) &&
          g.max_members > 0 &&
          Number(g.total_cost) > 0
      ),
    [rawGroups]
  );

  const services: SavingsService[] = useMemo(() => {
    const best = new Map<string, SavingsService>();
    for (const g of groups) {
      const solo = resolveService(g.service_name, g.service_type);
      if (!solo) continue; // senza prezzo singolo verificato non mostriamo nulla
      const seats = g.max_members;
      const perPerson = Number(g.total_cost) / seats + STRIPE_FEE_PER_PERSON;
      const item: SavingsService = {
        key: solo.key,
        name: solo.label,
        solo: solo.price,
        soloPlan: solo.plan,
        perPerson,
        seats,
        saving: solo.price - perPerson,
      };
      const current = best.get(solo.key);
      if (!current || item.saving > current.saving) best.set(solo.key, item);
    }
    return Array.from(best.values())
      .filter((s) => s.saving > 0)
      .sort((a, b) => b.saving - a.saving);
  }, [groups]);

  return { services, groups, isLoading };
}
