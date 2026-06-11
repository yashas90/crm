import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";

/** Refetch live data whenever the screen gains focus (tab switch, back navigation). */
export function useRefreshOnFocus(refetch: () => Promise<unknown> | undefined) {
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );
}
