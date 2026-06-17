import { ErrorState } from "@/components/ui/ErrorState";
import { type ProjectUnitRow, useProjectUnits } from "@/hooks/use-projects";
import type { ProfileStackParamList } from "@/navigation/types";
import { colors, radii, spacing, typography } from "@/theme";
import { TAB_BAR_SCROLL_PADDING } from "@/theme/layout";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useLayoutEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<ProfileStackParamList, "ProjectDetailScreen">;

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "available", label: "Available" },
  { value: "reserved", label: "Reserved" },
  { value: "booked", label: "Booked" },
  { value: "sold", label: "Sold" },
] as const;

function formatPrice(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

export function ProjectDetailScreen({ route, navigation }: Props) {
  const { projectId, projectName } = route.params;
  const [statusFilter, setStatusFilter] = useState("");
  const {
    data: units,
    isLoading,
    isError,
    refetch,
  } = useProjectUnits(projectId, statusFilter || undefined);
  const insets = useSafeAreaInsets();

  useLayoutEffect(() => {
    navigation.setOptions({ title: projectName });
  }, [navigation, projectName]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primaryLight} />
      </View>
    );
  }

  if (isError) {
    return <ErrorState message="Could not load units" onRetry={() => void refetch()} />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {STATUS_FILTERS.map((f) => (
          <Pressable
            key={f.value || "all"}
            style={[styles.chip, statusFilter === f.value && styles.chipActive]}
            onPress={() => setStatusFilter(f.value)}
          >
            <Text style={[styles.chipText, statusFilter === f.value && styles.chipTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_SCROLL_PADDING + insets.bottom }}>
        {(units ?? []).map((unit) => (
          <UnitRow
            key={unit.id}
            unit={unit}
            onPress={() =>
              navigation.navigate("ProjectUnitScreen", {
                projectId,
                unitId: unit.id,
                unitNumber: unit.unitNumber,
              })
            }
          />
        ))}
        {(units ?? []).length === 0 ? (
          <Text style={styles.empty}>No units match this filter.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function UnitRow({ unit, onPress }: { unit: ProjectUnitRow; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
    >
      <View style={styles.rowMain}>
        <Text style={styles.unitNumber}>{unit.unitNumber}</Text>
        <Text style={styles.unitMeta}>
          Floor {unit.floor} · {unit.bedrooms} BHK · {unit.areaSqFt} sqft
        </Text>
      </View>
      <View style={styles.rowEnd}>
        <Text style={styles.price}>{formatPrice(unit.priceListedRs)}</Text>
        <Text style={styles.status}>{unit.status}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundDark,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.backgroundDark,
  },
  filters: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.borderDark,
    marginRight: spacing.xs,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.caption,
    color: colors.textMutedDark,
    textTransform: "capitalize",
  },
  chipTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  rowPressed: {
    backgroundColor: colors.cardDark,
  },
  rowMain: {
    flex: 1,
  },
  unitNumber: {
    ...typography.body,
    color: colors.textDark,
    fontWeight: "600",
  },
  unitMeta: {
    ...typography.caption,
    color: colors.textMutedDark,
    marginTop: 2,
  },
  rowEnd: {
    alignItems: "flex-end",
  },
  price: {
    ...typography.caption,
    color: colors.textDark,
    fontWeight: "600",
  },
  status: {
    ...typography.caption,
    color: colors.textMutedDark,
    textTransform: "capitalize",
    marginTop: 2,
  },
  empty: {
    ...typography.body,
    color: colors.textMutedDark,
    textAlign: "center",
    marginTop: spacing.xl,
  },
});
