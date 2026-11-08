"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-renders the page from the server every `seconds` seconds, so new interview results show up on their own.
 * Reads only local files (cache and results); the PostHog query still runs only on the "Refresh from PostHog" button.
 */
export default function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    // After Back/Forward the page comes from the router cache, so fetch a fresh one right away.
    router.refresh();
    const timer = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);
  return null;
}
