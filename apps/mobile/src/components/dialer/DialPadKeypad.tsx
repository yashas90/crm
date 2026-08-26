import { colors, radii, spacing, typography } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

const KEYS: Array<{ label: string; sub?: string; value: string }> = [
  { label: "1", value: "1" },
  { label: "2", sub: "ABC", value: "2" },
  { label: "3", sub: "DEF", value: "3" },
  { label: "4", sub: "GHI", value: "4" },
  { label: "5", sub: "JKL", value: "5" },
  { label: "6", sub: "MNO", value: "6" },
  { label: "7", sub: "PQRS", value: "7" },
  { label: "8", sub: "TUV", value: "8" },
  { label: "9", sub: "WXYZ", value: "9" },
  { label: "*", value: "*" },
  { label: "0", sub: "+", value: "0" },
  { label: "#", value: "#" },
];

type DialPadKeypadProps = {
  onPressKey: (key: string) => void;
  onBackspace: () => void;
  onLongPressZero?: () => void;
};

export function DialPadKeypad({ onPressKey, onBackspace, onLongPressZero }: DialPadKeypadProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        {KEYS.map((key) => (
          <Pressable
            key={key.value}
            style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
            onPress={() => onPressKey(key.value)}
            onLongPress={key.value === "0" ? onLongPressZero : undefined}
            accessibilityRole="button"
            accessibilityLabel={`Dial ${key.label}`}
          >
            <Text style={styles.keyLabel}>{key.label}</Text>
            {key.sub ? <Text style={styles.keySub}>{key.sub}</Text> : null}
          </Pressable>
        ))}
      </View>
      <Pressable
        style={({ pressed }) => [styles.backspace, pressed && styles.keyPressed]}
        onPress={onBackspace}
        accessibilityRole="button"
        accessibilityLabel="Backspace"
      >
        <Ionicons name="backspace-outline" size={28} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: spacing.sm },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.sm,
    maxWidth: 280,
  },
  key: {
    width: 84,
    height: 64,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  keyPressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  keyLabel: { ...typography.h3, color: colors.text },
  keySub: { fontSize: 10, color: colors.textMuted, letterSpacing: 1, marginTop: 2 },
  backspace: {
    width: 84,
    height: 48,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
