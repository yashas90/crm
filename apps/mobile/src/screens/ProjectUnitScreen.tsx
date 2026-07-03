import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { useLeads } from "@/hooks/use-leads";
import {
  fetchBookingPdfUrl,
  useBookProjectUnit,
  useProjectUnits,
  useReleaseProjectUnit,
  useReserveProjectUnit,
  useUpdateProjectUnit,
} from "@/hooks/use-projects";
import { useIsManager } from "@/hooks/use-role";
import type { ProfileStackParamList } from "@/navigation/types";
import { colors, radii, spacing, typography } from "@/theme";
import { TAB_BAR_SCROLL_PADDING } from "@/theme/layout";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<ProfileStackParamList, "ProjectUnitScreen">;

const STATUS_COLORS: Record<string, string> = {
  available: colors.success,
  reserved: "#d97706",
  booked: colors.primary,
  sold: colors.textMuted,
};

function formatPrice(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

export function ProjectUnitScreen({ route, navigation }: Props) {
  const { projectId, unitId, unitNumber } = route.params;
  const isManager = useIsManager();
  const { data: units, isLoading, isError, refetch } = useProjectUnits(projectId);
  const reserve = useReserveProjectUnit(projectId);
  const book = useBookProjectUnit(projectId);
  const release = useReleaseProjectUnit(projectId);
  const updateUnit = useUpdateProjectUnit(projectId);
  const unit = units?.find((u) => u.id === unitId);
  const insets = useSafeAreaInsets();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [finalPrice, setFinalPrice] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const leadsQuery = useLeads(
    { search: leadSearch, page: "1", pageSize: "20" },
    { enabled: pickerOpen && leadSearch.length >= 2 },
  );
  const leadOptions = useMemo(() => leadsQuery.data?.items ?? [], [leadsQuery.data]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: `Unit ${unitNumber}` });
  }, [navigation, unitNumber]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isError || !unit) {
    return <ErrorState message="Could not load unit" onRetry={() => void refetch()} />;
  }

  const canReserve = unit.status === "available";
  const canBook = unit.status === "reserved" && unit.assignedLeadId;
  const canRelease = unit.status === "reserved" || unit.status === "booked";
  const canMarkSold = isManager && unit.status === "booked";
  const showPdf = unit.status === "booked" || unit.status === "sold";

  async function handleOpenPdf() {
    try {
      const result = await fetchBookingPdfUrl(projectId, unitId);
      if (result?.signedUrl) {
        await Linking.openURL(result.signedUrl);
      }
    } catch {
      Alert.alert("Error", "Could not open booking PDF.");
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingBottom: TAB_BAR_SCROLL_PADDING + insets.bottom,
        padding: spacing.md,
      }}
    >
      <View style={styles.card}>
        <InfoRow
          label="Status"
          value={unit.status}
          capitalize
          statusColor={STATUS_COLORS[unit.status]}
        />
        <InfoRow label="Floor" value={String(unit.floor)} />
        <InfoRow label="BHK" value={`${unit.bedrooms} BHK`} />
        <InfoRow label="Area" value={`${unit.areaSqFt} sqft`} />
        <InfoRow label="Listed price" value={formatPrice(unit.priceListedRs)} />
        {unit.priceFinalRs != null ? (
          <InfoRow label="Final price" value={formatPrice(unit.priceFinalRs)} />
        ) : null}
        {unit.assignedLead ? (
          <InfoRow label="Assigned lead" value={unit.assignedLead.name} />
        ) : null}
      </View>

      {canReserve ? (
        <Button
          label="Reserve for lead"
          onPress={() => setPickerOpen(true)}
          style={{ marginTop: spacing.md }}
        />
      ) : null}

      {canBook ? (
        <Button
          label="Confirm booking"
          onPress={() => {
            setFinalPrice(
              unit.priceFinalRs != null ? String(unit.priceFinalRs) : String(unit.priceListedRs),
            );
            setBookModalOpen(true);
          }}
          style={{ marginTop: spacing.md }}
        />
      ) : null}

      {canRelease ? (
        <Button
          label="Release unit"
          variant="secondary"
          onPress={() => {
            Alert.alert("Release unit", "Return this unit to available inventory?", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Release",
                style: "destructive",
                onPress: () => {
                  release.mutate(unit.id, {
                    onSuccess: () => navigation.goBack(),
                  });
                },
              },
            ]);
          }}
          loading={release.isPending}
          style={{ marginTop: spacing.sm }}
        />
      ) : null}

      {canMarkSold ? (
        <Button
          label="Mark as sold"
          variant="secondary"
          onPress={() => {
            updateUnit.mutate(
              { unitId: unit.id, status: "sold" },
              { onSuccess: () => void refetch() },
            );
          }}
          loading={updateUnit.isPending}
          style={{ marginTop: spacing.sm }}
        />
      ) : null}

      {showPdf ? (
        <Button
          label="Open booking PDF"
          variant="secondary"
          onPress={() => void handleOpenPdf()}
          style={{ marginTop: spacing.sm }}
        />
      ) : null}

      <Modal visible={pickerOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select lead</Text>
            <TextInput
              style={styles.search}
              placeholder="Search by name or phone…"
              placeholderTextColor={colors.textMuted}
              value={leadSearch}
              onChangeText={setLeadSearch}
            />
            <ScrollView style={styles.leadList}>
              {leadOptions.map((lead) => (
                <Pressable
                  key={lead.id}
                  style={({ pressed }) => [styles.leadRow, pressed && styles.leadRowPressed]}
                  onPress={() => {
                    reserve.mutate(
                      { unitId: unit.id, leadId: lead.id },
                      {
                        onSuccess: () => {
                          setPickerOpen(false);
                          void refetch();
                        },
                      },
                    );
                  }}
                >
                  <Text style={styles.leadName}>
                    {lead.firstName} {lead.lastName}
                  </Text>
                  {lead.phone ? <Text style={styles.leadPhone}>{lead.phone}</Text> : null}
                </Pressable>
              ))}
            </ScrollView>
            <Button label="Cancel" variant="secondary" onPress={() => setPickerOpen(false)} />
          </View>
        </View>
      </Modal>

      <Modal visible={bookModalOpen} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm booking</Text>
            <Text style={styles.modalHint}>
              Final price is optional. Booking generates a PDF summary and marks the lead as won.
            </Text>
            <TextInput
              style={styles.search}
              placeholder="Final price (₹)"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              value={finalPrice}
              onChangeText={setFinalPrice}
            />
            <View style={styles.modalActions}>
              <Button
                label="Cancel"
                variant="secondary"
                onPress={() => setBookModalOpen(false)}
                style={{ flex: 1 }}
              />
              <Button
                label="Book unit"
                loading={book.isPending}
                onPress={() => {
                  const parsed = finalPrice.trim() ? Number(finalPrice) : undefined;
                  book.mutate(
                    {
                      unitId: unit.id,
                      priceFinalRs: parsed,
                    },
                    {
                      onSuccess: (result) => {
                        setBookModalOpen(false);
                        Alert.alert(
                          "Booked",
                          result.bookingDocument
                            ? `Booking ref ${result.bookingDocument.bookingRef}`
                            : "Unit marked as booked.",
                        );
                        void refetch();
                      },
                      onError: (err) => {
                        Alert.alert(
                          "Error",
                          err instanceof Error ? err.message : "Could not book unit.",
                        );
                      },
                    },
                  );
                }}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function InfoRow({
  label,
  value,
  capitalize,
  statusColor,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
  statusColor?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text
        style={[
          styles.infoValue,
          capitalize && styles.capitalize,
          statusColor ? { color: statusColor } : null,
        ]}
      >
        {value}
      </Text>
    </View>
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
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  infoValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: "500",
  },
  capitalize: {
    textTransform: "capitalize",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.md,
    maxHeight: "70%",
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  modalHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  leadList: {
    maxHeight: 280,
    marginBottom: spacing.sm,
  },
  leadRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  leadRowPressed: {
    opacity: 0.8,
  },
  leadName: {
    ...typography.body,
    color: colors.text,
  },
  leadPhone: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
