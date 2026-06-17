import { RoleGate } from "@/components/RoleGate";
import { TeamCallLogListItem } from "@/components/calls/TeamCallLogListItem";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { type TeamCallLogItem, useTeamCallLogsInfinite } from "@/hooks/use-team-calls";
import { useTeamMembers } from "@/hooks/use-users";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import {
  CALL_DATE_FILTERS,
  CALL_OUTCOME_FILTERS,
  type CallDateFilter,
  type CallOutcomeFilter,
} from "@/lib/callLogFilters";
import { isForbiddenError } from "@/lib/query-errors";
import type { TeamStackParamList } from "@/navigation/types";
import { colors, radii, spacing, typography } from "@/theme";
import { TAB_BAR_SCROLL_PADDING } from "@/theme/layout";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<TeamStackParamList, "TeamCallLogsScreen">;

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function TeamCallLogsContent({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [dateFilter, setDateFilter] = useState<CallDateFilter>("today");
  const [outcomeFilter, setOutcomeFilter] = useState<CallOutcomeFilter>("all");
  const [agentId, setAgentId] = useState<string | undefined>();
  const [agentPickerOpen, setAgentPickerOpen] = useState(false);
  const [exportToast, setExportToast] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const members = useTeamMembers();
  const logs = useTeamCallLogsInfinite({ dateFilter, outcome: outcomeFilter, agentId });

  const items = useMemo(
    () => logs.data?.pages.flatMap((page) => page.calls) ?? [],
    [logs.data?.pages],
  );

  const selectedAgentLabel =
    agentId == null
      ? "All agents"
      : (members.data?.items.find((m) => m.id === agentId)?.name ?? "Agent");

  const refetchAll = useCallback(() => logs.refetch(), [logs]);
  useRefreshOnFocus(refetchAll);

  const handleExport = () => {
    setExportToast(true);
    setTimeout(() => setExportToast(false), 3000);
  };

  const handleViewLead = useCallback(
    (leadId: string) => {
      navigation.getParent()?.navigate("LeadsTab", {
        screen: "LeadDetailScreen",
        params: { leadId },
      });
    },
    [navigation],
  );

  if (logs.isError && isForbiddenError(logs.error)) {
    return <ErrorState message="Access denied." onRetry={() => navigation.goBack()} />;
  }

  if (logs.isError && items.length === 0) {
    return <ErrorState onRetry={() => void refetchAll()} />;
  }

  const listHeader = (
    <View>
      <View style={styles.toolbar}>
        <Pressable style={styles.agentPicker} onPress={() => setAgentPickerOpen(true)}>
          <Text style={styles.agentPickerLabel}>Agent</Text>
          <Text style={styles.agentPickerValue}>{selectedAgentLabel}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.textMutedDark} />
        </Pressable>
        <Pressable style={styles.exportBtn} onPress={handleExport}>
          <Ionicons name="download-outline" size={18} color={colors.primaryLight} />
          <Text style={styles.exportText}>Export</Text>
        </Pressable>
      </View>

      <Text style={styles.filterHeading}>Date</Text>
      <View style={styles.chipRow}>
        {CALL_DATE_FILTERS.map((option) => (
          <FilterChip
            key={option.id}
            label={option.label}
            active={dateFilter === option.id}
            onPress={() => {
              setDateFilter(option.id);
              setExpandedId(null);
            }}
          />
        ))}
      </View>

      <Text style={styles.filterHeading}>Outcome</Text>
      <View style={styles.chipRow}>
        {CALL_OUTCOME_FILTERS.map((option) => (
          <FilterChip
            key={option.id}
            label={option.label}
            active={outcomeFilter === option.id}
            onPress={() => {
              setOutcomeFilter(option.id);
              setExpandedId(null);
            }}
          />
        ))}
      </View>
    </View>
  );

  return (
    <>
      <FlatList
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: TAB_BAR_SCROLL_PADDING + insets.bottom },
          items.length === 0 && !logs.isLoading ? styles.emptyContent : null,
        ]}
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }: { item: TeamCallLogItem }) => (
          <TeamCallLogListItem
            item={item}
            expanded={expandedId === item.id}
            onToggle={() => setExpandedId((c) => (c === item.id ? null : item.id))}
            onViewLead={handleViewLead}
          />
        )}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          logs.isLoading ? (
            <ActivityIndicator color={colors.primaryLight} style={styles.loader} />
          ) : (
            <EmptyState
              title="No team calls"
              message="Calls logged by your team will appear here."
            />
          )
        }
        ListFooterComponent={
          logs.isFetchingNextPage ? (
            <ActivityIndicator color={colors.primaryLight} style={styles.footerLoader} />
          ) : null
        }
        onEndReached={() => {
          if (logs.hasNextPage && !logs.isFetchingNextPage) void logs.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={logs.isRefetching && !logs.isFetchingNextPage}
            onRefresh={() => void refetchAll()}
            tintColor={colors.primaryLight}
          />
        }
      />

      <Modal visible={agentPickerOpen} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setAgentPickerOpen(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Filter by agent</Text>
            <Pressable
              style={styles.modalOption}
              onPress={() => {
                setAgentId(undefined);
                setAgentPickerOpen(false);
              }}
            >
              <Text style={styles.modalOptionText}>All agents</Text>
            </Pressable>
            {(members.data?.items ?? []).map((member) => (
              <Pressable
                key={member.id}
                style={styles.modalOption}
                onPress={() => {
                  setAgentId(member.id);
                  setAgentPickerOpen(false);
                }}
              >
                <Text style={styles.modalOptionText}>{member.name}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {exportToast ? (
        <View style={[styles.toast, { bottom: TAB_BAR_SCROLL_PADDING + insets.bottom }]}>
          <Text style={styles.toastText}>Export available on web dashboard</Text>
        </View>
      ) : null}
    </>
  );
}

export function TeamCallLogsScreen(props: Props) {
  return (
    <RoleGate roles={["admin", "manager"]} onGoBack={() => props.navigation.goBack()}>
      <TeamCallLogsContent {...props} />
    </RoleGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundDark },
  content: { padding: spacing.md },
  emptyContent: { flexGrow: 1 },
  toolbar: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  agentPicker: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.cardDark,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
    padding: spacing.md,
  },
  agentPickerLabel: { color: colors.textMutedDark, fontSize: 11, fontWeight: "700" },
  agentPickerValue: { flex: 1, color: colors.textDark, fontSize: 14, fontWeight: "600" },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
    backgroundColor: colors.cardDark,
  },
  exportText: { color: colors.primaryLight, fontWeight: "600", fontSize: 13 },
  filterHeading: {
    ...typography.caption,
    color: colors.textMutedDark,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.sm },
  chip: {
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.cardDark,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  chipActive: { backgroundColor: "rgba(20, 184, 166, 0.15)", borderColor: colors.primaryLight },
  chipText: { color: colors.textMutedDark, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: colors.primaryLight },
  loader: { marginTop: spacing.xl },
  footerLoader: { marginVertical: spacing.md },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.cardDark,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    maxHeight: "60%",
  },
  modalTitle: { color: colors.textDark, fontSize: 18, fontWeight: "700", marginBottom: spacing.md },
  modalOption: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  modalOptionText: { color: colors.textDark, fontSize: 16 },
  toast: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.cardDark,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  toastText: { color: colors.textDark, textAlign: "center", fontWeight: "600" },
});
