import { apiGet, apiPost, apiPut } from "@/lib/apiClient";
import type { MyLeadsStackParamList } from "@/navigation/types";
import { colors, radii, spacing, typography } from "@/theme";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

type Detail = {
  id: string;
  leadCode: string;
  name: string;
  phone: string | null;
  city: string | null;
  email: string | null;
  locality: string | null;
  budget: string | null;
  propertyType: string | null;
  bedrooms: string | null;
  pipelineStage: string;
  priority: string;
  notes: string | null;
  qualifiedDaysAgo: number | null;
  activities: { id: string; type: string; metadata: Record<string, unknown>; createdAt: string }[];
};

const STAGES = [
  "new",
  "contacted",
  "site_visit_scheduled",
  "site_visit_done",
  "negotiation",
  "closed_won",
  "closed_lost",
] as const;

export function MyLeadDetailScreen({
  route,
}: NativeStackScreenProps<MyLeadsStackParamList, "MyLeadDetail">) {
  const queryClient = useQueryClient();
  const lead = useQuery({
    queryKey: ["my-lead", route.params.leadId],
    queryFn: () => apiGet<Detail>(`/api/agent/leads/${route.params.leadId}`),
  });
  const [notes, setNotes] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("11:00");
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["my-lead", route.params.leadId] });
    await queryClient.invalidateQueries({ queryKey: ["my-leads"] });
  };

  const stage = useMutation({
    mutationFn: (next: string) =>
      apiPut(`/api/agent/leads/${route.params.leadId}/stage`, { stage: next }),
    onSuccess: () => void refresh(),
    onError: (error) =>
      setMessage(error instanceof Error ? error.message : "Could not update stage"),
  });
  const activity = useMutation({
    mutationFn: (type: "note" | "call" | "site_visit") =>
      apiPost(`/api/agent/leads/${route.params.leadId}/activity`, { type, notes }),
    onSuccess: async () => {
      setNotes("");
      await refresh();
    },
  });

  const data = lead.data;
  if (!data) {
    return (
      <View style={styles.screen}>
        <Text style={styles.sub}>Loading lead…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
    >
      <Text style={styles.title}>{data.leadCode}</Text>
      <Text style={styles.name}>{data.name}</Text>
      <Text style={styles.sub}>{data.phone}</Text>
      <Text style={styles.sub}>
        {data.pipelineStage} · {data.priority} · qualified {data.qualifiedDaysAgo ?? 0} days ago
      </Text>
      <Text style={styles.sub}>
        {[data.city, data.locality, data.propertyType, data.bedrooms, data.budget]
          .filter(Boolean)
          .join(" · ")}
      </Text>
      {data.email ? <Text style={styles.sub}>{data.email}</Text> : null}
      {data.notes ? <Text style={styles.body}>{data.notes}</Text> : null}
      <Text style={styles.section}>Stage</Text>
      <View style={styles.row}>
        {STAGES.map((item) => (
          <Pressable key={item} style={styles.chip} onPress={() => stage.mutate(item)}>
            <Text style={[styles.chipText, data.pipelineStage === item && styles.on]}>{item}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable style={styles.button} onPress={() => stage.mutate("negotiation")}>
        <Text style={styles.buttonText}>Convert to negotiation</Text>
      </Pressable>
      <Text style={styles.section}>Log activity</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Notes"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />
      <View style={styles.row}>
        <Pressable style={styles.chip} onPress={() => activity.mutate("note")}>
          <Text style={styles.chipText}>Save note</Text>
        </Pressable>
        <Pressable style={styles.chip} onPress={() => activity.mutate("call")}>
          <Text style={styles.chipText}>Log call</Text>
        </Pressable>
      </View>
      <Text style={styles.section}>Schedule site visit</Text>
      <TextInput
        value={visitDate}
        onChangeText={setVisitDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />
      <TextInput
        value={visitTime}
        onChangeText={setVisitTime}
        placeholder="HH:MM"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />
      <Pressable
        style={styles.button}
        onPress={() => {
          void apiPost("/api/site-visits", {
            leadId: data.id,
            visitDate,
            visitTime,
            notes: notes || null,
            propertyAddress: data.city,
          })
            .then(() => stage.mutate("site_visit_scheduled"))
            .then(() => activity.mutate("site_visit"))
            .then(() => setMessage("Site visit scheduled"))
            .catch((error) =>
              setMessage(error instanceof Error ? error.message : "Could not schedule visit"),
            );
        }}
      >
        <Text style={styles.buttonText}>Schedule site visit</Text>
      </Pressable>
      {message ? <Text style={styles.sub}>{message}</Text> : null}
      <Text style={styles.section}>Activity</Text>
      {data.activities.map((item) => (
        <View key={item.id} style={styles.activity}>
          <Text style={styles.body}>
            {item.type} · {new Date(item.createdAt).toLocaleString()}
          </Text>
          <Text style={styles.sub}>{JSON.stringify(item.metadata)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  title: { ...typography.h2, color: colors.primaryLight },
  name: { ...typography.h3, color: colors.text },
  section: { color: colors.text, fontWeight: "700", marginTop: spacing.sm },
  sub: { color: colors.textMuted, fontSize: 13 },
  body: { color: colors.text, fontSize: 14 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: { color: colors.text, fontSize: 12 },
  on: { color: colors.primaryLight, fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    color: colors.text,
    padding: spacing.sm,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    padding: 12,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700" },
  activity: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
});
