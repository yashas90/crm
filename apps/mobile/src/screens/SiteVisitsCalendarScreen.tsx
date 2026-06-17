import { VisitDetailSheet } from "@/components/site-visits/VisitDetailSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import {
  type SiteVisit,
  agentColor,
  formatVisitTime,
  useSiteVisitsCalendar,
} from "@/hooks/use-site-visits";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import type { MainTabParamList } from "@/navigation/types";
import { colors, radii, spacing, typography } from "@/theme";
import { TAB_BAR_HEIGHT } from "@/theme/layout";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = BottomTabScreenProps<MainTabParamList, "VisitsTab">;

function weekRange() {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { dateFrom: fmt(start), dateTo: fmt(end) };
}

export function SiteVisitsCalendarScreen(_props: Props) {
  const insets = useSafeAreaInsets();
  const { dateFrom, dateTo } = weekRange();
  const { data, isLoading, refetch, isRefetching } = useSiteVisitsCalendar(dateFrom, dateTo);
  const [selected, setSelected] = useState<SiteVisit | null>(null);

  useRefreshOnFocus(refetch);

  const days = useMemo(() => {
    const grouped = data?.dates ?? {};
    return Object.keys(grouped)
      .sort()
      .map((date) => ({ date, visits: grouped[date] ?? [] }));
  }, [data?.dates]);

  return (
    <View style={[styles.container, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Team visits</Text>
        <Text style={styles.subtitle}>This week · color-coded by agent</Text>
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
            title="No visits this week"
            message="Scheduled site visits will appear here."
          />
        ) : (
          days.map((day) => (
            <View key={day.date} style={styles.dayBlock}>
              <Text style={styles.dayTitle}>{day.date}</Text>
              {day.visits.map((visit) => {
                const agentName = visit.agent?.name ?? "Agent";
                const leadName = visit.lead
                  ? `${visit.lead.firstName} ${visit.lead.lastName}`
                  : "Lead";
                return (
                  <Pressable
                    key={visit.id}
                    style={[styles.card, { borderLeftColor: agentColor(agentName) }]}
                    onPress={() => setSelected(visit)}
                  >
                    <Text style={styles.cardTime}>{formatVisitTime(visit.visitTime)}</Text>
                    <Text style={styles.cardLead}>{leadName}</Text>
                    <Text style={styles.cardMeta}>
                      {visit.propertyLabel ?? visit.propertyAddress ?? "Property"} · {agentName}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>

      <VisitDetailSheet
        visit={selected}
        visible={Boolean(selected)}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundDark },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  title: { ...typography.heading, color: colors.textDark, fontSize: 22 },
  subtitle: { color: colors.textMutedDark, fontSize: 13, marginTop: 4 },
  content: { padding: spacing.md, gap: spacing.md },
  dayBlock: { gap: spacing.sm },
  dayTitle: { color: colors.primaryLight, fontWeight: "700", fontSize: 14 },
  card: {
    backgroundColor: colors.cardDark,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderLeftWidth: 4,
  },
  cardTime: { color: colors.textDark, fontWeight: "700" },
  cardLead: { color: colors.textDark, fontSize: 15, marginTop: 2 },
  cardMeta: { color: colors.textMutedDark, fontSize: 12, marginTop: 4 },
});
