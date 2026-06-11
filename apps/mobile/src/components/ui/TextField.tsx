import { colors, radii, spacing } from "@/theme";
import { StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";

type TextFieldProps = TextInputProps & {
  label?: string;
  hint?: string;
};

export function TextField({ label, hint, style, ...props }: TextFieldProps) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor={colors.textMutedDark}
        {...props}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.sm },
  label: { color: colors.textMutedDark, fontSize: 13, fontWeight: "600", marginBottom: 6 },
  input: {
    backgroundColor: colors.cardDark,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
    color: colors.textDark,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 16,
  },
  hint: { color: colors.textMutedDark, fontSize: 12, marginTop: 6 },
});
