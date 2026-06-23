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
import { screenStyles } from "@/theme/screen";
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
        screenStyles.listRow,
        !item.isRead && styles.itemUnread,
        pressed && styles.itemPressed,
      ]}
      onPress={onPress}
    >
      <View style={[styles.iconWrap, !item.isRead && styles.iconWrapUnread]}>
        <Ionicons name={notificationIcon(item.type)} size={22} color={colors.primary} />
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
            <Ionicons name="open-outline" size={14} color={colors.textMuted} />
            <Text style={styles.leadHintText}>View lead</Text>
          </View>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
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
            backgroundColor={colors.sticky}
            color={colors.text}
          />
        ) : null}
      </View>

      {notifications.isLoading && !notifications.data ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
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
              tintColor={colors.primary}
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
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    backgroundColor: colors.sticky,
    paddingTop: spacing.sm,
  },
  title: { ...typography.heading, color: colors.text, fontSize: 24 },
  loader: { marginTop: spacing.xl },
  listContent: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  listEmpty: { flexGrow: 1, justifyContent: "center" },
  itemUnread: {
    backgroundColor: colors.sticky,
  },
  itemPressed: { opacity: 0.88 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
  },
  iconWrapUnread: {
    backgroundColor: "#dbeafe",
  },
  itemBody: { flex: 1, gap: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  typeLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.hot,
    borderWidth: 1,
    borderColor: colors.border,
  },
  message: { color: colors.text, fontSize: 15, lineHeight: 21, fontWeight: "500" },
  time: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  leadHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  leadHintText: { color: colors.primary, fontSize: 12, fontWeight: "700" },
});
