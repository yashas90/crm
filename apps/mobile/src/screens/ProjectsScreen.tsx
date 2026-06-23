import { ErrorState } from "@/components/ui/ErrorState";
import { useProjectsList } from "@/hooks/use-projects";
import type { ProfileStackParamList } from "@/navigation/types";
import { colors, radii, spacing, typography } from "@/theme";
import { TAB_BAR_SCROLL_PADDING } from "@/theme/layout";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<ProfileStackParamList, "ProjectsScreen">;

function summaryLine(summary?: {
  available: number;
  reserved: number;
  sold: number;
}) {
  if (!summary) return "No inventory data";
  return `${summary.available} available • ${summary.reserved} reserved • ${summary.sold} sold`;
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: TAB_BAR_SCROLL_PADDING + insets.bottom }}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          tintColor={colors.primary}
        />
      }
    >
      {(projects ?? []).map((project) => (
        <Pressable
          key={project.id}
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
          <Text style={styles.summary}>{summaryLine(project.unitSummary)}</Text>
        </Pressable>
      ))}
      {isRefetching ? (
        <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.primary} />
      ) : null}
    </ScrollView>
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
