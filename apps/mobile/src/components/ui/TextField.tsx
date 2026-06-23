import { colors, spacing } from "@/theme";
import { neuInput } from "@/theme/neubrutal";
import { StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";

type TextFieldProps = TextInputProps & {
  label?: string;
  hint?: string;
  inputTestID?: string;
};

export function TextField({ label, hint, style, inputTestID, ...props }: TextFieldProps) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        testID={inputTestID}
        style={[styles.input, style]}
        placeholderTextColor={colors.textMuted}
        {...props}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.sm },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    ...neuInput,
    color: colors.text,
    fontSize: 16,
    fontWeight: "500",
  },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: 6 },
});
