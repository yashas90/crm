import { FollowUpQuickPicker } from "@/components/FollowUpQuickPicker";
import type { LeadRow } from "@/hooks/use-leads";
import { apiGet, apiPost } from "@/lib/apiClient";
import type { LeadsStackParamList } from "@/navigation/types";
import { colors, radii, spacing, typography } from "@/theme";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
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
  const [debouncedPhone, setDebouncedPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [leadSource, setLeadSource] = useState<string>(LEAD_SOURCE_OPTIONS[0].value);
  const [tags, setTags] = useState("");
  const [nextFollowupAt, setNextFollowupAt] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const digits = phone.replace(/\D/g, "");
    if (digits.length >= 10) {
      debounceRef.current = setTimeout(() => setDebouncedPhone(digits), 600);
    } else {
      setDebouncedPhone("");
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [phone]);

  const { data: dupCheck } = useQuery({
    queryKey: ["leads", "dup-check", debouncedPhone],
    queryFn: () =>
      apiGet<{ items: LeadRow[]; total: number }>(`/api/leads?search=${debouncedPhone}&pageSize=5`),
    enabled: Boolean(debouncedPhone),
    staleTime: 10_000,
  });

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

  const dupMatches = debouncedPhone && (dupCheck?.items ?? []).length > 0 ? dupCheck!.items : [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>New lead</Text>

      <View style={styles.field}>
        <Text style={styles.label}>First name *</Text>
        <TextInput
          testID="lead-first-name"
          style={styles.input}
          value={firstName}
          onChangeText={setFirstName}
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Last name</Text>
        <TextInput
          style={styles.input}
          value={lastName}
          onChangeText={setLastName}
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Phone *</Text>
        <TextInput
          testID="lead-phone"
          style={[styles.input, dupMatches.length > 0 && styles.inputWarn]}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholderTextColor={colors.textMuted}
        />
        {dupMatches.length > 0 ? (
          <View style={styles.dupWarn}>
            <Text style={styles.dupWarnTitle}>
              ⚠️ {dupMatches.length} existing lead{dupMatches.length > 1 ? "s" : ""} with this number
            </Text>
            {dupMatches.slice(0, 3).map((d) => (
              <Text key={d.id} style={styles.dupWarnRow}>
                {d.firstName} {d.lastName} · {d.leadStatus}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>City</Text>
        <TextInput
          style={styles.input}
          value={city}
          onChangeText={setCity}
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>State</Text>
        <TextInput
          style={styles.input}
          value={state}
          onChangeText={setState}
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Lead source</Text>
        <View style={styles.chipRow}>
          {LEAD_SOURCE_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              testID={`lead-source-${opt.value}`}
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
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Next follow-up (optional)</Text>
        <FollowUpQuickPicker value={nextFollowupAt} onChange={setNextFollowupAt} />
      </View>

      <Pressable
        testID="lead-create-submit"
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
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  heading: { ...typography.subheading, color: colors.text, marginBottom: spacing.md },
  field: { marginBottom: spacing.sm },
  label: { color: colors.textMuted, marginBottom: 4, fontSize: 12, fontWeight: "600" },
  input: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    padding: spacing.sm,
  },
  inputWarn: {
    borderColor: "#f59e0b",
  },
  dupWarn: {
    marginTop: 6,
    backgroundColor: "rgba(245,158,11,0.1)",
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.35)",
    padding: spacing.sm,
  },
  dupWarnTitle: { color: "#f59e0b", fontSize: 12, fontWeight: "700", marginBottom: 4 },
  dupWarnRow: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
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
