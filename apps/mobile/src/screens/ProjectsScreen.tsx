import { ErrorState } from "@/components/ui/ErrorState";
import { type UnitSummary, useProjectsList } from "@/hooks/use-projects";
import { FLAT_LIST_PERF } from "@/lib/flatList";
import type { ProfileStackParamList } from "@/navigation/types";
import { colors, radii, spacing, typography } from "@/theme";
import { TAB_BAR_SCROLL_PADDING } from "@/theme/layout";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<ProfileStackParamList, "ProjectsScreen">;

function summaryLine(summary?: UnitSummary) {
  if (!summary) return "No inventory data";
  return `${summary.available} available · ${summary.reserved} reserved · ${summary.booked} booked · ${summary.sold} sold`;
}

export function ProjectsScreen({ navigation }: Props) {
  const { data: projects, isLoading, isError, refetch, isRefetching } = useProjectsList();
  const insets = useSafeAreaInsets();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isError) {
    return <ErrorState message="Could not load projects" onRetry={() => void refetch()} />;
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ paddingBottom: TAB_BAR_SCROLL_PADDING + insets.bottom }}
      data={projects ?? []}
      keyExtractor={(item) => item.id}
      {...FLAT_LIST_PERF}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          tintColor={colors.primary}
        />
      }
      renderItem={({ item: project }) => (
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() =>
            navigation.navigate("ProjectDetailScreen", {
              projectId: project.id,
              projectName: project.name,
            })
          }
        >
          <View style={styles.cardHeader}>
            <Text style={styles.projectName}>{project.name}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
          <Text style={styles.summary}>{summaryLine(project.unitSummary ?? undefined)}</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPressed: {
    opacity: 0.9,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  projectName: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
    flex: 1,
  },
  summary: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
