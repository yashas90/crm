import { dialLeadPhone, openLeadWhatsApp } from "@/lib/leadDialPhone";
import { colors, radii, spacing } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

type LeadContactActionsProps = {
  phone: string | null | undefined;
  /** Required when phone may be masked — used to fetch the real number for Call/WhatsApp. */
  leadId?: string | null;
  leadName?: string;
  /** Called after the native dialer opens — use to start call-return tracking. */
  onCallStarted?: (dialedPhone: string) => void;
  /** Override default SIM dial (e.g. DNC consent check on lead detail). */
  onCallPress?: () => void | Promise<void>;
  /** Opens template picker instead of direct WhatsApp link. */
  onWhatsAppPress?: () => void | Promise<void>;
  onLogPress?: () => void;
  /** Compact vertical stack for list rows (Today queue). */
  variant?: "row" | "stack";
  disabled?: boolean;
};

export function LeadContactActions({
  phone,
  leadId,
  leadName,
  onCallStarted,
  onCallPress,
  onWhatsAppPress,
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
    if (!phone && !leadId) {
      Alert.alert("No phone", "This lead has no phone number.");
      return;
    }
    const { opened, phone: dialed } = await dialLeadPhone({ leadId, phone });
    if (opened && dialed) onCallStarted?.(dialed);
  }

  async function handleWhatsApp() {
    if (!phone && !leadId) {
      Alert.alert("No phone", "This lead has no phone number.");
      return;
    }
    if (onWhatsAppPress) {
      await onWhatsAppPress();
      return;
    }
    await openLeadWhatsApp({ leadId, phone, leadName });
  }

  if (variant === "stack") {
    return (
      <View style={styles.stack}>
        <ActionChip
          icon="call"
          label="Call"
          tint={colors.primary}
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
            tint={colors.text}
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
        testID="lead-call-button"
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
          <Ionicons name="clipboard-outline" size={18} color={colors.text} />
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
      <Ionicons name={icon} size={14} color={ghost ? colors.textMuted : tint} />
      <Text style={[styles.chipText, { color: ghost ? colors.text : tint }]}>{label}</Text>
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
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 12,
    backgroundColor: colors.card,
  },
  logBtnText: { color: colors.text, fontWeight: "600", fontSize: 15 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1.5,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.background,
  },
  chipGhost: {
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipText: { fontSize: 12, fontWeight: "700" },
  disabledBtn: { opacity: 0.45 },
});
