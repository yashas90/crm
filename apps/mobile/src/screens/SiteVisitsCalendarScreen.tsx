import { SiteVisitCard } from "@/components/site-visits/SiteVisitCard";
import { VisitDetailSheet } from "@/components/site-visits/VisitDetailSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useIsManager } from "@/hooks/use-role";
import { type SiteVisit, useSiteVisitsCalendar } from "@/hooks/use-site-visits";
import { useTeamMembers } from "@/hooks/use-users";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import type { VisitsStackParamList } from "@/navigation/types";
import { colors, radii, spacing } from "@/theme";
import { getIstDateKey, getIstMonthBounds, getIstWeekBounds } from "@propninja/types/ist";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

type Props = NativeStackScreenProps<VisitsStackParamList, "SiteVisitsCalendarScreen">;
type RangeMode = "week" | "month";

function offsetReference(offset: number, mode: RangeMode): Date {
  const date = new Date();
  if (mode === "week") {
    date.setDate(date.getDate() + offset * 7);
  } else {
    date.setMonth(date.getMonth() + offset);
  }
  return date;
}

function rangeForMode(reference: Date, mode: RangeMode) {
  if (mode === "month") {
    const { start, end } = getIstMonthBounds(reference);
    return { dateFrom: getIstDateKey(start), dateTo: getIstDateKey(end) };
  }
  const { start, end } = getIstWeekBounds(reference);
  return { dateFrom: getIstDateKey(start), dateTo: getIstDateKey(end) };
}

export function SiteVisitsCalendarScreen(_props: Props) {
  const isManager = useIsManager();
  const members = useTeamMembers();
  const [mode, setMode] = useState<RangeMode>("week");
  const [offset, setOffset] = useState(0);
  const [agentFilter, setAgentFilter] = useState<string | undefined>(undefined);
  const [agentPickerOpen, setAgentPickerOpen] = useState(false);
  const [selected, setSelected] = useState<SiteVisit | null>(null);

  const reference = useMemo(() => offsetReference(offset, mode), [offset, mode]);
  const { dateFrom, dateTo } = useMemo(() => rangeForMode(reference, mode), [reference, mode]);

  const { data, isLoading, refetch, isRefetching } = useSiteVisitsCalendar(
    dateFrom,
    dateTo,
    isManager ? agentFilter : undefined,
  );

  useRefreshOnFocus(refetch);

  const days = useMemo(() => {
    const grouped = data?.dates ?? {};
    return Object.keys(grouped)
      .sort()
      .map((date) => ({ date, visits: grouped[date] ?? [] }));
  }, [data?.dates]);

  const rangeLabel =
    mode === "week" ? `${dateFrom} → ${dateTo}` : `${dateFrom.slice(0, 7)} (month to date)`;

  const agentLabel = !agentFilter
    ? "All agents"
    : (members.data?.items.find((m) => m.id === agentFilter)?.name ?? "Agent");

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <View style={styles.modeRow}>
          <Pressable
            style={[styles.modeBtn, mode === "week" && styles.modeBtnActive]}
            onPress={() => {
              setMode("week");
              setOffset(0);
            }}
          >
            <Text style={[styles.modeText, mode === "week" && styles.modeTextActive]}>Week</Text>
          </Pressable>
          <Pressable
            style={[styles.modeBtn, mode === "month" && styles.modeBtnActive]}
            onPress={() => {
              setMode("month");
              setOffset(0);
            }}
          >
            <Text style={[styles.modeText, mode === "month" && styles.modeTextActive]}>Month</Text>
          </Pressable>
        </View>

        <View style={styles.navRow}>
          <Pressable style={styles.navBtn} onPress={() => setOffset((v) => v - 1)}>
            <Text style={styles.navBtnText}>← Prev</Text>
          </Pressable>
          <Text style={styles.rangeLabel}>{rangeLabel}</Text>
          <Pressable style={styles.navBtn} onPress={() => setOffset((v) => v + 1)}>
            <Text style={styles.navBtnText}>Next →</Text>
          </Pressable>
        </View>

        {offset !== 0 ? (
          <Pressable style={styles.todayBtn} onPress={() => setOffset(0)}>
            <Text style={styles.todayBtnText}>Back to current {mode}</Text>
          </Pressable>
        ) : null}

        {isManager ? (
          <Pressable style={styles.agentPicker} onPress={() => setAgentPickerOpen(true)}>
            <Text style={styles.agentPickerText}>{agentLabel}</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
        }
      >
        {isLoading && !data ? (
          <ListSkeleton rows={5} />
        ) : days.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title={`No visits in this ${mode}`}
            message="Scheduled site visits will appear here."
          />
        ) : (
          days.map((day) => (
            <View key={day.date} style={styles.dayBlock}>
              <Text style={styles.dayTitle}>{day.date}</Text>
              <View style={styles.dayList}>
                {day.visits.map((visit) => (
                  <SiteVisitCard
                    key={visit.id}
                    visit={visit}
                    showAgent={isManager}
                    onPress={() => setSelected(visit)}
                  />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <VisitDetailSheet
        visit={selected}
        visible={Boolean(selected)}
        onClose={() => setSelected(null)}
        onCompleted={() => void refetch()}
      />

      <Modal visible={agentPickerOpen} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setAgentPickerOpen(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Filter by agent</Text>
            <Pressable
              style={styles.modalOption}
              onPress={() => {
                setAgentFilter(undefined);
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  toolbar: {
    padding: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modeRow: { flexDirection: "row", gap: spacing.xs },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  modeBtnActive: { backgroundColor: "#dbeafe", borderColor: colors.primary },
  modeText: { color: colors.textMuted, fontWeight: "600", fontSize: 13 },
  modeTextActive: { color: colors.primary },
  navRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  navBtn: { paddingVertical: 6, paddingHorizontal: 8 },
  navBtnText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  rangeLabel: { color: colors.text, fontWeight: "600", fontSize: 12, flex: 1, textAlign: "center" },
  todayBtn: { alignSelf: "center" },
  todayBtnText: { color: colors.textMuted, fontSize: 12, textDecorationLine: "underline" },
  agentPicker: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  agentPickerText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  content: { padding: spacing.md, gap: spacing.md },
  dayBlock: { gap: spacing.sm },
  dayTitle: { color: colors.primary, fontWeight: "700", fontSize: 14 },
  dayList: { gap: spacing.sm },
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
