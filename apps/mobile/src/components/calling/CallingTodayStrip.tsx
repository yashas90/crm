import { apiGet } from "@/lib/apiClient";
import type { MainTabParamList } from "@/navigation/types";
import { colors, radii, spacing } from "@/theme";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function CallingTodayStrip() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const calling = useQuery({
    queryKey: ["calling-stats"],
    queryFn: () =>
      apiGet<{ remaining: number; pending: number; callbacks: number; calledToday: number }>(
        "/api/agent/calling-data/stats",
      ),
    retry: false,
    refetchInterval: false,
    meta: { suppressErrorToast: true },
  });
  const leads = useQuery({
    queryKey: ["my-leads-stats"],
    queryFn: () =>
      apiGet<{ total: number; hot: number; byStage: Record<string, number> }>(
        "/api/agent/leads/stats",
      ),
    retry: false,
    refetchInterval: false,
    meta: { suppressErrorToast: true },
  });
  const visit =
    (leads.data?.byStage.site_visit_scheduled ?? 0) + (leads.data?.byStage.site_visit_done ?? 0);

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.card} onPress={() => navigation.navigate("CallingTab")}>
        <Text style={styles.label}>Calling data</Text>
        <Text style={styles.value}>{calling.data?.remaining ?? 0} remaining</Text>
        <Text style={styles.meta}>
          Pending {calling.data?.pending ?? 0} · Callbacks {calling.data?.callbacks ?? 0} · Called
          today {calling.data?.calledToday ?? 0}
        </Text>
      </Pressable>
      <Pressable style={styles.card} onPress={() => navigation.navigate("MyLeadsTab")}>
        <Text style={styles.label}>My leads</Text>
        <Text style={styles.value}>{leads.data?.total ?? 0} qualified</Text>
        <Text style={styles.meta}>
          Hot {leads.data?.hot ?? 0} · Site visits {visit}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, marginTop: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: 4,
  },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  value: { color: colors.text, fontSize: 18, fontWeight: "700" },
  meta: { color: colors.textMuted, fontSize: 13 },
});
