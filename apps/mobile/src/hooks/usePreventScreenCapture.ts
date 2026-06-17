import { useFocusEffect } from "@react-navigation/native";
import { allowScreenCaptureAsync, preventScreenCaptureAsync } from "expo-screen-capture";
import { useCallback, useEffect } from "react";

/** Blocks screenshots and screen recording while the screen is focused. */
export function usePreventScreenCaptureOnFocus() {
  useFocusEffect(
    useCallback(() => {
      void preventScreenCaptureAsync();
      return () => {
        void allowScreenCaptureAsync();
      };
    }, []),
  );
}

/** Blocks capture while `active` is true (modals, sheets). */
export function usePreventScreenCaptureWhile(active: boolean) {
  useEffect(() => {
    if (!active) return;
    void preventScreenCaptureAsync();
    return () => {
      void allowScreenCaptureAsync();
    };
  }, [active]);
}
