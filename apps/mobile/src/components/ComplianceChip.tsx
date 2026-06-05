import { colors, radii } from "@/theme";
import { StyleSheet, Text, View } from "react-native";

type ComplianceChipProps = {
  callConsent: boolean | null;
};

export function ComplianceChip({ callConsent }: ComplianceChipProps) {
  const config =
    callConsent === true
      ? { label: "OK to call", container: styles.ok, text: styles.okText }
      : callConsent === false
        ? { label: "Do not call", container: styles.blocked, text: styles.blockedText }
        : { label: "Consent unknown", container: styles.unknown, text: styles.unknownText };

  return (
    <View style={[styles.chip, config.container]}>
      <Text style={[styles.label, config.text]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  label: { fontSize: 12, fontWeight: "600" },
  ok: { backgroundColor: "rgba(16, 185, 129, 0.15)" },
  okText: { color: colors.success },
  blocked: { backgroundColor: "rgba(239, 68, 68, 0.15)" },
  blockedText: { color: colors.danger },
  unknown: { backgroundColor: "rgba(148, 163, 184, 0.15)" },
  unknownText: { color: colors.textMutedDark },
});
