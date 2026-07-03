import { SiteVisitCard } from "@/components/site-visits/SiteVisitCard";
import { VisitDetailSheet } from "@/components/site-visits/VisitDetailSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useIsManager } from "@/hooks/use-role";
import { type SiteVisit, useTodaySiteVisits } from "@/hooks/use-site-visits";
import { useTeamMembers } from "@/hooks/use-users";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import type { VisitsStackParamList } from "@/navigation/types";
import { colors, radii, shadows, spacing, typography } from "@/theme";
import { TAB_BAR_SCROLL_PADDING } from "@/theme/layout";
import { getIstDateKey } from "@propninja/types/ist";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useMemo, useState } from "react";
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<VisitsStackParamList, "SiteVisitsHomeScreen">;

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

export function SiteVisitsHomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const isManager = useIsManager();
  const members = useTeamMembers();
  const [agentFilter, setAgentFilter] = useState<string | undefined>(undefined);
  const [agentPickerOpen, setAgentPickerOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<SiteVisit | null>(null);

  const todayVisits = useTodaySiteVisits(isManager ? agentFilter : undefined);
  const visits = useMemo(
    () =>
      (todayVisits.data?.items ?? [])
        .slice()
        .sort((a, b) => a.visitTime.localeCompare(b.visitTime)),
    [todayVisits.data?.items],
  );
  const scheduledCount = visits.filter((v) => v.status === "scheduled").length;

  const refetch = useCallback(() => todayVisits.refetch(), [todayVisits]);
  useRefreshOnFocus(refetch);

  const agentLabel =
    !isManager || !agentFilter
      ? isManager
        ? "All agents"
        : "My visits"
      : (members.data?.items.find((m) => m.id === agentFilter)?.name ?? "Agent");

  const todayLabel = getIstDateKey();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Site Visits</Text>
        <Text style={styles.subtitle}>
          {todayLabel} · {scheduledCount} scheduled today
        </Text>
      </View>

      {isManager ? (
        <View style={styles.filterRow}>
          <FilterChip
            label="All agents"
            active={!agentFilter}
            onPress={() => setAgentFilter(undefined)}
          />
          <Pressable style={styles.agentPicker} onPress={() => setAgentPickerOpen(true)}>
            <Text style={styles.agentPickerText}>{agentLabel}</Text>
            <Text style={styles.agentPickerHint}>Agent ▾</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_BAR_SCROLL_PADDING + insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={todayVisits.isRefetching}
            onRefresh={() => void refetch()}
            tintColor={colors.primary}
          />
        }
      >
        <Pressable
          style={styles.calendarBanner}
          onPress={() => navigation.navigate("SiteVisitsCalendarScreen")}
        >
          <Text style={styles.calendarBannerTitle}>Open calendar</Text>
          <Text style={styles.calendarBannerHint}>Week & month view of all scheduled visits</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>Today</Text>

        {todayVisits.isLoading && !todayVisits.data ? (
          <ListSkeleton rows={3} />
        ) : todayVisits.isError && !todayVisits.data ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Could not load visits"
            message="Pull to refresh or try again."
          />
        ) : visits.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="No visits today"
            message="Scheduled site visits for today will appear here."
          />
        ) : (
          <View style={styles.list}>
            {visits.map((visit) => (
              <SiteVisitCard
                key={visit.id}
                visit={visit}
                showAgent={isManager}
                onPress={() => setSelectedVisit(visit)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <VisitDetailSheet
        visit={selectedVisit}
        visible={Boolean(selectedVisit)}
        onClose={() => setSelectedVisit(null)}
        onCompleted={() => void refetch()}
      />

      <Modal visible={agentPickerOpen} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setAgentPickerOpen(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Filter by agent</Text>
            {(members.data?.items ?? []).map((member) => (
              <Pressable
                key={member.id}
                style={styles.modalOption}
                onPress={() => {
                  setAgentFilter(member.id);
                  setAgentPickerOpen(false);
                }}
              >
                <Text style={styles.modalOptionText}>{member.name}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  title: { ...typography.heading, color: colors.text, fontSize: 22 },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    alignItems: "center",
  },
  chip: {
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.neuSm,
  },
  chipActive: { backgroundColor: "#dbeafe", borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: colors.primary },
  agentPicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  agentPickerText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  agentPickerHint: { color: colors.textMuted, fontSize: 11 },
  calendarBanner: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  calendarBannerTitle: { color: colors.primary, fontWeight: "800", fontSize: 15 },
  calendarBannerHint: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  sectionTitle: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 14,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  list: { paddingHorizontal: spacing.md, gap: spacing.sm },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    maxHeight: "70%",
  },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: spacing.sm },
  modalOption: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalOptionText: { color: colors.text, fontSize: 16 },
});
