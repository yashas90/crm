import { type LeadRow, type LeadsQuery, useLeads } from "@/hooks/use-leads";
import { getCurrentUserId } from "@/lib/auth";
import type { LeadsStackParamList } from "@/navigation/types";
import { colors, radii, spacing, typography } from "@/theme";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Props = NativeStackScreenProps<LeadsStackParamList, "LeadsScreen">;

type FilterChip = "all" | "mine" | "hot" | "new";

function initials(lead: LeadRow) {
  return `${lead.firstName[0] ?? ""}${lead.lastName[0] ?? ""}`.toUpperCase();
}

function daysSinceContact(value: string | null | undefined) {
  if (!value) return "Never contacted";
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (days === 0) return "Last contact: today";
  if (days === 1) return "Last contact: 1 day ago";
  return `Last contact: ${days} days ago`;
}

function LeadItem({ lead, onPress }: { lead: LeadRow; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(lead)}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.titleRow}>
          <Text style={styles.name}>
            {lead.firstName} {lead.lastName}
          </Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{lead.leadStatus}</Text>
          </View>
        </View>
        <Text style={styles.subline}>
          {lead.phone ?? "No phone"} · {lead.city ?? "No city"}
        </Text>
        <Text style={styles.contactLine}>{daysSinceContact(lead.lastContactedAt)}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export function LeadsScreen({ navigation }: Props) {
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<FilterChip>("all");

  const queryParams = useMemo(() => {
    const params: LeadsQuery = { page: "1", pageSize: "50" };
    if (search.trim()) params.search = search.trim();
    if (chip === "hot") params.temperature = "hot";
    if (chip === "new") params.status = "new";
    if (chip === "mine") params.assignedTo = getCurrentUserId();
    return params;
  }, [search, chip]);

  const { data, isLoading, isError, refetch, isRefetching } = useLeads(queryParams);

  const leads = useMemo(() => {
    const items = data?.items ?? [];
    if (chip !== "mine") return items;
    return items;
  }, [data, chip]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primaryLight} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Unable to load leads.</Text>
        <Pressable style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const chips: { id: FilterChip; label: string }[] = [
    { id: "all", label: "All" },
    { id: "mine", label: "My Leads" },
    { id: "hot", label: "Hot" },
    { id: "new", label: "New" },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Leads</Text>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or phone"
          placeholderTextColor={colors.textMutedDark}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.chipsRow}>
        {chips.map((item) => (
          <Pressable
            key={item.id}
            style={[styles.chip, chip === item.id && styles.chipActive]}
            onPress={() => setChip(item.id)}
          >
            <Text style={[styles.chipText, chip === item.id && styles.chipTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={leads}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primaryLight}
          />
        }
        ListEmptyComponent={<Text style={styles.empty}>No leads found.</Text>}
        renderItem={({ item }) => (
          <LeadItem
            lead={item}
            onPress={() => navigation.navigate("LeadDetailScreen", { leadId: item.id })}
          />
        )}
      />

      <Pressable
        style={styles.fab}
        onPress={() => navigation.navigate("LeadCreateScreen")}
        accessibilityLabel="Create new lead"
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundDark },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: { ...typography.heading, color: colors.textDark },
  searchWrap: { paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  searchInput: {
    backgroundColor: colors.cardDark,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.textDark,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  chip: {
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.cardDark,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMutedDark, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  list: { flex: 1 },
  listContent: { padding: spacing.md, paddingTop: 0 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardDark,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderDark,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardPressed: { opacity: 0.85 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  cardBody: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  name: { color: colors.textDark, fontSize: 16, fontWeight: "700", flexShrink: 1 },
  statusBadge: {
    backgroundColor: "rgba(20,184,166,0.15)",
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: {
    color: colors.primaryLight,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  subline: { color: colors.textMutedDark, fontSize: 13, marginBottom: 4 },
  contactLine: { color: colors.textMutedDark, fontSize: 12 },
  chevron: { color: colors.textMutedDark, fontSize: 24, marginLeft: 4 },
  center: {
    flex: 1,
    backgroundColor: colors.backgroundDark,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  empty: { color: colors.textMutedDark, textAlign: "center", marginTop: 40 },
  errorText: { color: colors.danger, marginBottom: 12 },
  retryButton: {
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryText: { color: colors.textDark, fontWeight: "600" },
  fab: {
    position: "absolute",
    right: spacing.md,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabText: { color: "#fff", fontSize: 28, fontWeight: "300", lineHeight: 30 },
});
