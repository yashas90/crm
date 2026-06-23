import { colors, radii, spacing, typography } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type BannerPayload = {
  title: string;
  body: string;
  leadId?: string;
};

type InAppNotificationBannerProps = {
  onNavigateToLead?: (leadId: string) => void;
};

const AUTO_DISMISS_MS = 5000;

export function InAppNotificationBanner({ onNavigateToLead }: InAppNotificationBannerProps) {
  const insets = useSafeAreaInsets();
  const [banner, setBanner] = useState<BannerPayload | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const showBanner = (payload: BannerPayload) => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      setBanner(payload);
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      dismissTimer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
          setBanner(null),
        );
      }, AUTO_DISMISS_MS);
    };

    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const content = notification.request.content;
      const data = content.data as Record<string, unknown>;
      const leadId = typeof data.leadId === "string" ? data.leadId : undefined;
      showBanner({
        title: content.title ?? "PropNinja",
        body: content.body ?? "",
        leadId,
      });
    });

    return () => {
      sub.remove();
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [opacity]);

  if (!banner) return null;

  function dismiss() {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
      setBanner(null),
    );
  }

  function handlePress() {
    const leadId = banner?.leadId;
    dismiss();
    if (leadId) onNavigateToLead?.(leadId);
  }

  return (
    <Animated.View
      style={[styles.wrap, { top: insets.top + spacing.sm, opacity }]}
      pointerEvents="box-none"
    >
      <Pressable
        style={({ pressed }) => [styles.banner, pressed && styles.bannerPressed]}
        onPress={banner.leadId ? handlePress : dismiss}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="notifications" size={20} color={colors.primary} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {banner.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {banner.body}
          </Text>
        </View>
        <Pressable onPress={dismiss} hitSlop={12} accessibilityLabel="Dismiss notification">
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    zIndex: 100,
    elevation: 12,
  },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  bannerPressed: { opacity: 0.92 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: { flex: 1, gap: 2 },
  title: { ...typography.subheading, color: colors.text },
  body: { ...typography.caption, color: colors.textMuted, fontWeight: "400" },
});
