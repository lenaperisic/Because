"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Ponovo iscrta stranu sa servera na svakih `seconds` sekundi, da se novi rezultati intervjua pojave sami.
 * Čita samo lokalne fajlove (keš i rezultate); upit u PostHog i dalje ide samo na dugme „Osveži iz PostHoga“.
 */
export default function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    // Posle Back/Forward strana dolazi iz keša rutera, pa odmah povuci svežu.
    router.refresh();
    const timer = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);
  return null;
}
