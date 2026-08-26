import { colors, radii, shadows, spacing } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { memo, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

type Props = {
  activeFilterCount: number;
  onDebouncedSearchChange: (value: string) => void;
  onOpenFilters: () => void;
  /** Debounce delay for search → query (ms). */
  debounceMs?: number;
  placeholder?: string;
  showFilterButton?: boolean;
};

/**
 * Isolates search TextInput state so keystrokes do not re-render the leads FlatList.
 */
function LeadsSearchBarComponent({
  activeFilterCount,
  onDebouncedSearchChange,
  onOpenFilters,
  debounceMs = 400,
  placeholder = "Search name, phone, or Lead ID",
  showFilterButton = true,
}: Props) {
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => onDebouncedSearchChange(search.trim()), debounceMs);
    return () => clearTimeout(timer);
  }, [search, debounceMs, onDebouncedSearchChange]);

  return (
    <View style={styles.searchRow}>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>
      {showFilterButton ? (
        <Pressable
          style={styles.filterBtn}
          onPress={onOpenFilters}
          accessibilityLabel="Open lead filters"
        >
          <Ionicons name="options-outline" size={22} color={colors.text} />
          {activeFilterCount > 0 ? (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}

export const LeadsSearchBar = memo(LeadsSearchBarComponent);
LeadsSearchBar.displayName = "LeadsSearchBar";

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  searchWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    ...shadows.neuSm,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.neuSm,
  },
  filterBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  filterBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
});
