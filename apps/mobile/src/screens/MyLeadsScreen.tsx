import { apiGet } from "@/lib/apiClient";
import { dialPhoneNumber, openWhatsAppChat } from "@/lib/phoneActions";
import type { MyLeadsStackParamList } from "@/navigation/types";
import { colors, radii, spacing, typography } from "@/theme";
import { TAB_BAR_SCROLL_PADDING } from "@/theme/layout";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type LeadCard = {
  id: string;
  leadCode: string;
  name: string;
  phone: string | null;
  city: string | null;
  budget: string | null;
  pipelineStage: string;
  priority: string;
  qualifiedDaysAgo: number | null;
};

const TABS = [
  { id: "", label: "All" },
  { id: "hot", label: "Hot", priority: "hot" },
  { id: "warm", label: "Warm", priority: "warm" },
  { id: "cold", label: "Cold", priority: "cold" },
  { id: "site_visit_scheduled", label: "Site Visit", stage: "site_visit_scheduled" },
  { id: "negotiation", label: "Negotiation", stage: "negotiation" },
] as const;

const PRIORITY_COLOR: Record<string, string> = {
  hot: colors.hot,
  warm: colors.warning,
  cold: colors.primaryLight,
};

export function MyLeadsScreen({
  navigation,
}: NativeStackScreenProps<MyLeadsStackParamList, "MyLeadsHome">) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("");
  const [search, setSearch] = useState("");
  const selected = TABS.find((item) => item.id === tab) ?? TABS[0];
  const query = new URLSearchParams();
  if ("priority" in selected && selected.priority) query.set("priority", selected.priority);
  if ("stage" in selected && selected.stage) query.set("stage", selected.stage);
  if (search.trim()) query.set("search", search.trim());
  const qs = query.toString();

  const list = useQuery({
    queryKey: ["my-leads", qs],
    queryFn: () => apiGet<LeadCard[]>(`/api/agent/leads${qs ? `?${qs}` : ""}`),
  });
  const stats = useQuery({
    queryKey: ["my-leads-stats"],
    queryFn: () => apiGet<{ total: number; hot: number }>("/api/agent/leads/stats"),
  });

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <FlatList
        data={list.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: TAB_BAR_SCROLL_PADDING + insets.bottom,
        }}
        ListHeaderComponent={
          <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
            <Text style={styles.title}>
              My Leads — {stats.data?.total ?? list.data?.length ?? 0}
            </Text>
            <Text style={styles.sub}>
              Qualified from calling data. These leads are never auto-deleted.
            </Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search my leads"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
            <View style={styles.row}>
              {TABS.map((item) => (
                <Pressable
                  key={item.id || "all"}
                  onPress={() => setTab(item.id)}
                  style={styles.chip}
                >
                  <Text style={[styles.chipText, tab === item.id && styles.on]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => navigation.navigate("MyLeadDetail", { leadId: item.id })}
          >
            <Text style={[styles.code, { color: PRIORITY_COLOR[item.priority] ?? colors.text }]}>
              {item.leadCode} · {item.priority}
            </Text>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.sub}>{item.phone}</Text>
            <Text style={styles.sub}>
              {item.pipelineStage} · {item.budget ?? "No budget"} · qualified{" "}
              {item.qualifiedDaysAgo ?? 0} days ago
            </Text>
            <View style={styles.row}>
              <Pressable
                style={styles.action}
                onPress={() => item.phone && void dialPhoneNumber(item.phone)}
              >
                <Text style={styles.actionText}>Call</Text>
              </Pressable>
              <Pressable
                style={styles.action}
                onPress={() =>
                  item.phone && void openWhatsAppChat(item.phone, { leadName: item.name })
                }
              >
                <Text style={styles.actionText}>WhatsApp</Text>
              </Pressable>
              <Pressable
                style={styles.action}
                onPress={() =>
                  navigation.navigate("MyLeadDetail", { leadId: item.id, logActivity: true })
                }
              >
                <Text style={styles.actionText}>Log Activity</Text>
              </Pressable>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.sub}>No qualified leads yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  title: { ...typography.h2, color: colors.text },
  name: { ...typography.h3, color: colors.text },
  code: { fontWeight: "700" },
  sub: { color: colors.textMuted, fontSize: 13 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    color: colors.text,
    padding: spacing.sm,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: { color: colors.text, fontSize: 13 },
  on: { color: colors.primaryLight, fontWeight: "700" },
  action: {
    backgroundColor: colors.cardElevated,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionText: { color: colors.text, fontWeight: "600" },
});
