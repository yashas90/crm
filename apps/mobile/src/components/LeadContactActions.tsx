import { dialPhoneNumber, openWhatsAppChat } from "@/lib/phoneActions";
import { colors, radii, spacing } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

type LeadContactActionsProps = {
  phone: string | null | undefined;
  leadName?: string;
  /** Called after the native dialer opens — use to start call-return tracking. */
  onCallStarted?: () => void;
  /** Override default SIM dial (e.g. DNC consent check on lead detail). */
  onCallPress?: () => void | Promise<void>;
  onLogPress?: () => void;
  /** Compact vertical stack for list rows (Today queue). */
  variant?: "row" | "stack";
  disabled?: boolean;
};

export function LeadContactActions({
  phone,
  leadName,
  onCallStarted,
  onCallPress,
  onLogPress,
  variant = "row",
  disabled = false,
}: LeadContactActionsProps) {
  const hasPhone = Boolean(phone?.trim());

  async function handleCall() {
    if (onCallPress) {
      await onCallPress();
      return;
    }
    if (!phone) {
      Alert.alert("No phone", "This lead has no phone number.");
      return;
    }
    const opened = await dialPhoneNumber(phone);
    if (opened) onCallStarted?.();
  }

  async function handleWhatsApp() {
    if (!phone) {
      Alert.alert("No phone", "This lead has no phone number.");
      return;
    }
    await openWhatsAppChat(phone, { leadName });
  }

  if (variant === "stack") {
    return (
      <View style={styles.stack}>
        <ActionChip
          icon="call"
          label="Call"
          tint={colors.primaryLight}
          onPress={() => void handleCall()}
          disabled={disabled || !hasPhone}
        />
        <ActionChip
          icon="logo-whatsapp"
          label="WA"
          tint="#25D366"
          onPress={() => void handleWhatsApp()}
          disabled={disabled || !hasPhone}
        />
        {onLogPress ? (
          <ActionChip
            icon="create-outline"
            label="Log"
            tint={colors.textDark}
            onPress={onLogPress}
            disabled={disabled}
            ghost
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Pressable
        style={[styles.primaryBtn, (!hasPhone || disabled) && styles.disabledBtn]}
        onPress={() => void handleCall()}
        disabled={disabled || !hasPhone}
      >
        <Ionicons name="call" size={20} color="#fff" />
        <Text style={styles.primaryBtnText}>Call</Text>
      </Pressable>
      <Pressable
        style={[styles.waBtn, (!hasPhone || disabled) && styles.disabledBtn]}
        onPress={() => void handleWhatsApp()}
        disabled={disabled || !hasPhone}
      >
        <Ionicons name="logo-whatsapp" size={20} color="#fff" />
        <Text style={styles.primaryBtnText}>WhatsApp</Text>
      </Pressable>
      {onLogPress ? (
        <Pressable style={styles.logBtn} onPress={onLogPress} disabled={disabled}>
          <Ionicons name="clipboard-outline" size={18} color={colors.textDark} />
          <Text style={styles.logBtnText}>Log call</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ActionChip({
  icon,
  label,
  tint,
  onPress,
  disabled,
  ghost,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tint: string;
  onPress: () => void;
  disabled?: boolean;
  ghost?: boolean;
}) {
  return (
    <Pressable
      style={[
        styles.chip,
        ghost && styles.chipGhost,
        disabled && styles.disabledBtn,
        !ghost && { borderColor: tint },
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons name={icon} size={14} color={ghost ? colors.textMutedDark : tint} />
      <Text style={[styles.chipText, { color: ghost ? colors.textDark : tint }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, marginBottom: spacing.md },
  stack: { gap: 6, alignItems: "stretch" },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 14,
  },
  waBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#128C7E",
    borderRadius: radii.md,
    paddingVertical: 14,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  logBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: radii.md,
    paddingVertical: 12,
    backgroundColor: colors.cardDark,
  },
  logBtnText: { color: colors.textDark, fontWeight: "600", fontSize: 15 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1.5,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.backgroundDark,
  },
  chipGhost: {
    borderColor: colors.borderDark,
    backgroundColor: colors.cardDark,
  },
  chipText: { fontSize: 12, fontWeight: "700" },
  disabledBtn: { opacity: 0.45 },
});
