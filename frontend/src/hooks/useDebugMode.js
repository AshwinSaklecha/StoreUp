import { useMemo } from "react";

export function useDebugMode() {
  return useMemo(
    () => new URLSearchParams(window.location.search).get("debug") === "1",
    []
  );
}
