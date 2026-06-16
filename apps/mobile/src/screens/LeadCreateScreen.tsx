import { FollowUpQuickPicker } from "@/components/FollowUpQuickPicker";
import { apiPost } from "@/lib/apiClient";
import type { LeadsStackParamList } from "@/navigation/types";
import { colors, radii, spacing, typography } from "@/theme";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Props = NativeStackScreenProps<LeadsStackParamList, "LeadCreateScreen">;

const LEAD_SOURCE_OPTIONS = [
  { label: "Portal", value: "portal" },
  { label: "Walk-in", value: "walk-in" },
  { label: "Referral", value: "referral" },
  { label: "Campaign", value: "campaign" },
  { label: "Facebook", value: "facebook" },
  { label: "Google", value: "google" },
  { label: "IVR", value: "ivr" },
  { label: "Other", value: "other" },
] as const;

export function LeadCreateScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [leadSource, setLeadSource] = useState<string>(LEAD_SOURCE_OPTIONS[0].value);
  const [tags, setTags] = useState("");
  const [nextFollowupAt, setNextFollowupAt] = useState<string | null>(null);

  const createLead = useMutation({
    mutationFn: () => {
      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      return apiPost<{ id: string }>("/api/leads", {
        firstName,
        lastName: lastName || undefined,
        phone,
        email: email || undefined,
        city: city || undefined,
        state: state || undefined,
        leadSource: leadSource || undefined,
        tags: tagList.length > 0 ? tagList : undefined,
        nextFollowupAt: nextFollowupAt ?? undefined,
      });
    },
    onSuccess: async (lead) => {
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      navigation.replace("LeadDetailScreen", { leadId: lead.id });
    },
    onError: (err) => {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to create lead");
    },
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>New lead</Text>
      {(
        [
          ["First name *", firstName, setFirstName],
          ["Last name", lastName, setLastName],
          ["Phone *", phone, setPhone],
          ["Email", email, setEmail],
          ["City", city, setCity],
          ["State", state, setState],
        ] as const
      ).map(([label, value, setter]) => (
        <View key={label} style={styles.field}>
          <Text style={styles.label}>{label}</Text>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setter}
            keyboardType={
              label.includes("Phone")
                ? "phone-pad"
                : label.includes("Email")
                  ? "email-address"
                  : "default"
            }
            placeholderTextColor={colors.textMutedDark}
          />
        </View>
      ))}

      <View style={styles.field}>
        <Text style={styles.label}>Lead source</Text>
        <View style={styles.chipRow}>
          {LEAD_SOURCE_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              style={[styles.chip, leadSource === opt.value && styles.chipActive]}
              onPress={() => setLeadSource(opt.value)}
            >
              <Text style={[styles.chipText, leadSource === opt.value && styles.chipTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Tags</Text>
        <TextInput
          style={styles.input}
          value={tags}
          onChangeText={setTags}
          placeholder="comma, separated"
          placeholderTextColor={colors.textMutedDark}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Next follow-up (optional)</Text>
        <FollowUpQuickPicker value={nextFollowupAt} onChange={setNextFollowupAt} />
      </View>

      <Pressable
        style={styles.button}
        onPress={() => {
          if (!firstName.trim() || !phone.trim()) {
            Alert.alert("Required", "First name and phone are required.");
            return;
          }
          createLead.mutate();
        }}
        disabled={createLead.isPending}
      >
        {createLead.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Create lead</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundDark },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  heading: { ...typography.subheading, color: colors.textDark, marginBottom: spacing.md },
  field: { marginBottom: spacing.sm },
  label: { color: colors.textMutedDark, marginBottom: 4, fontSize: 12, fontWeight: "600" },
  input: {
    backgroundColor: colors.cardDark,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
    color: colors.textDark,
    padding: spacing.sm,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.cardDark,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMutedDark, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.md,
  },
  buttonText: { color: "#fff", fontWeight: "700" },
});
