import { ErrorState } from "@/components/ui/ErrorState";
import { type BookingListItem, currentMonthIsoRange, useBookingsList } from "@/hooks/use-projects";
import type { ProfileStackParamList } from "@/navigation/types";
import { colors, radii, spacing, typography } from "@/theme";
import { TAB_BAR_SCROLL_PADDING } from "@/theme/layout";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<ProfileStackParamList, "BookingsScreen">;

function formatPrice(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

export function BookingsScreen({ navigation }: Props) {
  const defaultRange = useMemo(() => currentMonthIsoRange(), []);
  const [search, setSearch] = useState("");
  const insets = useSafeAreaInsets();

  const { data, isLoading, isError, refetch, isRefetching } = useBookingsList({
    page: 1,
    pageSize: 50,
    dateFrom: defaultRange.dateFrom,
    dateTo: defaultRange.dateTo,
    search: search.trim() || undefined,
  });

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isError) {
    return <ErrorState message="Could not load bookings" onRetry={() => void refetch()} />;
  }

  const items = data?.items ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder="Search bookings…"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_BAR_SCROLL_PADDING + insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={colors.primary}
          />
        }
      >
        {items.length === 0 ? (
          <Text style={styles.empty}>No bookings this month.</Text>
        ) : (
          items.map((item) => (
            <BookingRow
              key={item.id}
              item={item}
              onPress={() =>
                navigation.navigate("ProjectUnitScreen", {
                  projectId: item.projectId,
                  unitId: item.unitId,
                  unitNumber: item.unitNumber,
                })
              }
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function BookingRow({ item, onPress }: { item: BookingListItem; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.ref}>{item.bookingRef}</Text>
        <Text style={styles.date}>
          {new Date(item.generatedAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
          })}
        </Text>
      </View>
      <Text style={styles.project}>{item.projectName}</Text>
      <Text style={styles.meta}>
        Unit {item.unitNumber} · F{item.floor} · {item.bedrooms} BHK
      </Text>
      <Text style={styles.lead}>{item.leadName}</Text>
      <Text style={styles.price}>
        {item.priceFinalRs != null
          ? formatPrice(item.priceFinalRs)
          : formatPrice(item.priceListedRs)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  searchWrap: {
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.card,
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPressed: {
    opacity: 0.9,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  ref: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "600",
    fontFamily: "monospace",
  },
  date: {
    ...typography.caption,
    color: colors.textMuted,
  },
  project: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  lead: {
    ...typography.caption,
    color: colors.text,
    marginTop: spacing.xs,
  },
  price: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
    marginTop: spacing.xs,
  },
});
