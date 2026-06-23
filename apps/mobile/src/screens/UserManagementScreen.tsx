import { RoleGate } from "@/components/RoleGate";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { type OrgUser, useUpdateUser, useUsers } from "@/hooks/use-users";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { isForbiddenError } from "@/lib/query-errors";
import type { ProfileStackParamList } from "@/navigation/types";
import { colors, radii, spacing, typography } from "@/theme";
import { TAB_BAR_SCROLL_PADDING } from "@/theme/layout";
import type { UserRole } from "@propninja/types/permissions";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<ProfileStackParamList, "UserManagementScreen">;

const ROLES: UserRole[] = ["agent", "manager", "admin"];

function UserManagementContent({ navigation: _navigation }: Props) {
  const insets = useSafeAreaInsets();
  const users = useUsers();
  const updateUser = useUpdateUser();
  const [selected, setSelected] = useState<OrgUser | null>(null);
  const [editRole, setEditRole] = useState<UserRole>("agent");
  const [editActive, setEditActive] = useState(true);

  useRefreshOnFocus(() => users.refetch());

  if (users.isError && isForbiddenError(users.error)) {
    return <ErrorState message="Access denied. Admin role required." />;
  }

  if (users.isError && !users.data) {
    return <ErrorState onRetry={() => void users.refetch()} />;
  }

  const openEdit = (user: OrgUser) => {
    setSelected(user);
    setEditRole(user.role);
    setEditActive(user.isActive);
  };

  const saveEdit = async () => {
    if (!selected) return;
    await updateUser.mutateAsync({
      userId: selected.id,
      payload: { role: editRole, isActive: editActive },
    });
    setSelected(null);
  };

  return (
    <>
      <FlatList
        style={styles.container}
        contentContainerStyle={{ paddingBottom: TAB_BAR_SCROLL_PADDING + insets.bottom }}
        data={users.data?.items ?? []}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={users.isRefetching}
            onRefresh={() => void users.refetch()}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>User management</Text>
            <Text style={styles.subtitle}>{users.data?.total ?? 0} users</Text>
          </View>
        }
        ListEmptyComponent={users.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => openEdit(item)}>
            <View style={styles.rowBody}>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowMeta}>
                {item.role} · {item.isActive ? "Active" : "Inactive"}
              </Text>
            </View>
            <Text style={styles.rowEmail}>{item.email}</Text>
          </Pressable>
        )}
      />

      <Modal visible={Boolean(selected)} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{selected?.name}</Text>
            <Text style={styles.modalLabel}>Role</Text>
            <View style={styles.roleRow}>
              {ROLES.map((role) => (
                <Pressable
                  key={role}
                  style={[styles.roleChip, editRole === role && styles.roleChipActive]}
                  onPress={() => setEditRole(role)}
                >
                  <Text
                    style={[styles.roleChipText, editRole === role && styles.roleChipTextActive]}
                  >
                    {role}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.modalLabel}>Active</Text>
              <Switch
                value={editActive}
                onValueChange={setEditActive}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>
            <View style={styles.modalActions}>
              <Button label="Cancel" variant="secondary" onPress={() => setSelected(null)} />
              <Button label="Save" onPress={() => void saveEdit()} loading={updateUser.isPending} />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

export function UserManagementScreen(props: Props) {
  return (
    <RoleGate roles={["admin"]} onGoBack={() => props.navigation.goBack()}>
      <UserManagementContent {...props} />
    </RoleGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.md },
  title: { ...typography.heading, color: colors.text, fontSize: 22 },
  subtitle: { color: colors.textMuted, marginTop: 4 },
  row: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowBody: { marginBottom: 4 },
  rowName: { color: colors.text, fontSize: 16, fontWeight: "700" },
  rowMeta: { color: colors.primary, fontSize: 12, textTransform: "capitalize" },
  rowEmail: { color: colors.textMuted, fontSize: 13 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
  },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: "700", marginBottom: spacing.md },
  modalLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  roleRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  roleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleChipActive: { borderColor: colors.primary, backgroundColor: "#dbeafe" },
  roleChipText: { color: colors.textMuted, textTransform: "capitalize" },
  roleChipTextActive: { color: colors.primary, fontWeight: "700" },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  modalActions: { flexDirection: "row", gap: spacing.sm },
});
