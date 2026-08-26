import { LeadListItem } from "@/components/LeadListItem";
import { LeadsSearchBar } from "@/components/LeadsSearchBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { type LeadRow, useInfiniteLeads } from "@/hooks/use-leads";
import { colors, radii, spacing, typography } from "@/theme";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";

type LinkLeadPickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (lead: LeadRow) => void;
};

export function LinkLeadPickerModal({ visible, onClose, onSelect }: LinkLeadPickerModalProps) {
  const [search, setSearch] = useState("");

  const queryParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (search.trim()) params.search = search.trim();
    return params;
  }, [search]);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteLeads(queryParams);

  const leads = useMemo(() => {
    const pages = data?.pages;
    if (!pages?.length) return [] as LeadRow[];
    return pages.flatMap((page) => page.items ?? []);
  }, [data?.pages]);

  const renderItem = useCallback(
    ({ item }: { item: LeadRow }) => (
      <LeadListItem lead={item} onPress={() => onSelect(item)} highlightQuery={search.trim()} />
    ),
    [onSelect, search],
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Link to lead</Text>
          <Pressable onPress={onClose} accessibilityRole="button">
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>

        <LeadsSearchBar
          activeFilterCount={0}
          onDebouncedSearchChange={setSearch}
          onOpenFilters={() => undefined}
          placeholder="Search name, phone, or Lead ID…"
          showFilterButton={false}
        />

        {isLoading && !data ? (
          <ListSkeleton rows={6} />
        ) : (
          <FlatList
            data={leads}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
            }}
            ListEmptyComponent={
              <EmptyState
                icon="people-outline"
                title="No leads found"
                message="Try a different search term."
              />
            }
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: spacing.lg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  title: { ...typography.heading, color: colors.text },
  close: { color: colors.primary, fontWeight: "700" },
  listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
});
