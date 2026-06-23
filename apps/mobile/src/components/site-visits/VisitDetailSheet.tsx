import { CompleteSiteVisitSheet } from "@/components/site-visits/CompleteSiteVisitSheet";
import { type SiteVisit, formatVisitTime, useUpdateSiteVisit } from "@/hooks/use-site-visits";
import { dialPhoneNumber } from "@/lib/dialPhone";
import { colors, radii, spacing, typography } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, Linking, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type VisitDetailSheetProps = {
  visit: SiteVisit | null;
  visible: boolean;
  onClose: () => void;
  onCompleted?: () => void;
};

export function VisitDetailSheet({ visit, visible, onClose, onCompleted }: VisitDetailSheetProps) {
  const updateVisit = useUpdateSiteVisit();
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [completeSheetOpen, setCompleteSheetOpen] = useState(false);

  if (!visit) return null;

  const leadName = visit.lead ? `${visit.lead.firstName} ${visit.lead.lastName}` : "Lead";
  const property = visit.propertyLabel ?? visit.propertyAddress ?? "Property TBD";

  async function setStatus(status: SiteVisit["status"]) {
    try {
      await updateVisit.mutateAsync({ id: visit.id, payload: { status } });
      onClose();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Update failed");
    }
  }

  function handleVisitCompleted() {
    Alert.alert("Visit completed", "Would you like to update the lead stage to Site Visit?", [
      { text: "Not now", style: "cancel", onPress: onClose },
      { text: "Update stage", onPress: () => onCompleted?.() },
    ]);
  }

  async function openMaps() {
    const address = visit.propertyAddress ?? visit.propertyLabel;
    if (!address) {
      Alert.alert("No address", "No property address on this visit.");
      return;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    await Linking.openURL(url);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView edges={["bottom"]} style={styles.sheet}>
          <Text style={styles.title}>{leadName}</Text>
          <Text style={styles.subtitle}>
            {visit.visitDate} · {formatVisitTime(visit.visitTime)} · {visit.duration} min
          </Text>
          <Text style={styles.property}>{property}</Text>

          {visit.lead?.phone ? (
            <Pressable
              style={styles.actionRow}
              onPress={() => void dialPhoneNumber(visit.lead!.phone!)}
            >
              <Ionicons name="call" size={18} color={colors.primary} />
              <Text style={styles.actionText}>{visit.lead.phone}</Text>
            </Pressable>
          ) : null}

          <Pressable style={styles.actionRow} onPress={() => void openMaps()}>
            <Ionicons name="map-outline" size={18} color={colors.primary} />
            <Text style={styles.actionText}>Open in Google Maps</Text>
          </Pressable>

          {visit.notes ? <Text style={styles.notes}>{visit.notes}</Text> : null}

          <View style={styles.reschedule}>
            <Text style={styles.sectionLabel}>Reschedule</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              value={rescheduleDate}
              onChangeText={setRescheduleDate}
            />
            <TextInput
              style={styles.input}
              placeholder="HH:MM (24h)"
              placeholderTextColor={colors.textMuted}
              value={rescheduleTime}
              onChangeText={setRescheduleTime}
            />
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => {
                if (!rescheduleDate || !rescheduleTime) return;
                void updateVisit
                  .mutateAsync({
                    id: visit.id,
                    payload: {
                      visitDate: rescheduleDate,
                      visitTime: rescheduleTime,
                      status: "scheduled",
                    },
                  })
                  .then(onClose);
              }}
            >
              <Text style={styles.secondaryBtnText}>Save new time</Text>
            </Pressable>
          </View>

          <View style={styles.actions}>
            {visit.status === "scheduled" ? (
              <Pressable style={styles.primaryBtn} onPress={() => setCompleteSheetOpen(true)}>
                <Text style={styles.primaryBtnText}>Mark complete</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.secondaryBtn} onPress={() => void setStatus("no_show")}>
              <Text style={styles.secondaryBtnText}>No show</Text>
            </Pressable>
          </View>

          <CompleteSiteVisitSheet
            visible={completeSheetOpen}
            visit={visit}
            onClose={() => setCompleteSheetOpen(false)}
            onCompleted={handleVisitCompleted}
          />

          <Pressable onPress={onClose} style={styles.close}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { ...typography.subheading, color: colors.text },
  subtitle: { color: colors.textMuted, fontSize: 13 },
  property: { color: colors.text, fontSize: 15, fontWeight: "600" },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  actionText: { color: colors.primary, fontWeight: "600" },
  notes: { color: colors.textMuted, fontSize: 14, marginTop: spacing.sm },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  secondaryBtn: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryBtnText: { color: colors.text, fontWeight: "600" },
  reschedule: { marginTop: spacing.sm },
  close: { alignItems: "center", paddingVertical: spacing.sm },
  closeText: { color: colors.textMuted },
});
