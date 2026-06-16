import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  type NotificationRow,
  formatNotificationLabel,
  formatNotificationType,
  leadIdFromPayload,
  useMarkNotificationsRead,
  useNotifications,
} from "@/hooks/use-notifications";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { formatDateTime } from "@/lib/dates";
import type { MainTabParamList } from "@/navigation/types";
import { colors, radii, spacing, typography } from "@/theme";
import { TAB_BAR_SCROLL_PADDING } from "@/theme/layout";
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = BottomTabScreenProps<MainTabParamList, "NotificationsTab">;

function notificationIcon(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case "lead_assigned":
      return "person-add-outline";
    case "followup_due":
      return "alarm-outline";
    default:
      return "notifications-outline";
  }
}

function NotificationItem({
  item,
  onPress,
}: {
  item: NotificationRow;
  onPress: () => void;
}) {
  const leadId = leadIdFromPayload(item.payload);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.item,
        !item.isRead && styles.itemUnread,
        pressed && styles.itemPressed,
      ]}
      onPress={onPress}
    >
      <View style={[styles.iconWrap, !item.isRead && styles.iconWrapUnread]}>
        <Ionicons name={notificationIcon(item.type)} size={22} color={colors.primaryLight} />
      </View>
      <View style={styles.itemBody}>
        <View style={styles.titleRow}>
          <Text style={styles.typeLabel}>{formatNotificationType(item.type)}</Text>
          {!item.isRead ? <View style={styles.unreadDot} /> : null}
        </View>
        <Text style={styles.message}>{formatNotificationLabel(item)}</Text>
        <Text style={styles.time}>{formatDateTime(item.createdAt)}</Text>
        {leadId ? (
          <View style={styles.leadHint}>
            <Ionicons name="open-outline" size={14} color={colors.textMutedDark} />
            <Text style={styles.leadHintText}>View lead</Text>
          </View>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMutedDark} />
    </Pressable>
  );
}

export function NotificationsScreen({ navigation }: Props) {
  const notifications = useNotifications();
  const markRead = useMarkNotificationsRead();

  const refetch = useCallback(() => notifications.refetch(), [notifications]);
  useRefreshOnFocus(refetch);

  const handlePress = useCallback(
    async (item: NotificationRow) => {
      if (!item.isRead) {
        await markRead.mutateAsync([item.id]);
      }

      const leadId = leadIdFromPayload(item.payload);
      if (leadId) {
        navigation.navigate("LeadsTab", {
          screen: "LeadDetailScreen",
          params: { leadId },
        });
      }
    },
    [markRead, navigation],
  );

  if (notifications.isError && !notifications.data) {
    return <ErrorState onRetry={refetch} />;
  }

  const items = notifications.data?.items ?? [];
  const unreadCount = notifications.data?.unreadCount ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 ? (
          <Badge
            label={`${unreadCount} unread`}
            backgroundColor="rgba(20, 184, 166, 0.2)"
            color={colors.primaryLight}
          />
        ) : null}
      </View>

      {notifications.isLoading && !notifications.data ? (
        <ActivityIndicator color={colors.primaryLight} style={styles.loader} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            items.length === 0 && styles.listEmpty,
            { paddingBottom: TAB_BAR_SCROLL_PADDING },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={notifications.isRefetching}
              onRefresh={refetch}
              tintColor={colors.primaryLight}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="notifications-off-outline"
              title="No notifications yet"
              message="Follow-up reminders and lead assignments will appear here."
            />
          }
          renderItem={({ item }) => (
            <NotificationItem item={item} onPress={() => void handlePress(item)} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundDark },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  title: { ...typography.heading, color: colors.textDark, fontSize: 26 },
  loader: { marginTop: spacing.xl },
  listContent: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  listEmpty: { flexGrow: 1, justifyContent: "center" },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.cardDark,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderDark,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  itemUnread: {
    borderColor: "rgba(20, 184, 166, 0.35)",
    backgroundColor: "rgba(20, 184, 166, 0.08)",
  },
  itemPressed: { opacity: 0.88 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(148, 163, 184, 0.12)",
  },
  iconWrapUnread: {
    backgroundColor: "rgba(20, 184, 166, 0.15)",
  },
  itemBody: { flex: 1, gap: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  typeLabel: {
    color: colors.textDark,
    fontSize: 14,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.primaryLight,
  },
  message: { color: colors.textDark, fontSize: 15, lineHeight: 21 },
  time: { color: colors.textMutedDark, fontSize: 12, marginTop: 2 },
  leadHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  leadHintText: { color: colors.textMutedDark, fontSize: 12, fontWeight: "600" },
});
