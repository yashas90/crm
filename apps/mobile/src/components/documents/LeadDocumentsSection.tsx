import { ShareDocumentSheet } from "@/components/documents/ShareDocumentSheet";
import {
  type Document,
  type LeadDocumentShare,
  useDocumentSignedUrl,
  useLeadDocuments,
  useShareDocument,
} from "@/hooks/use-documents";
import { colors, radii, spacing, typography } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type DocumentActionSheetProps = {
  visible: boolean;
  document: Document | null;
  leadId: string;
  leadName: string;
  leadPhone?: string | null;
  onClose: () => void;
};

export function DocumentActionSheet({
  visible,
  document,
  leadId,
  leadName,
  leadPhone,
  onClose,
}: DocumentActionSheetProps) {
  const share = useShareDocument(leadId);
  const signedUrl = useDocumentSignedUrl();
  const [busy, setBusy] = useState(false);

  if (!document) return null;

  async function shareWhatsApp() {
    setBusy(true);
    try {
      await share.mutateAsync({ documentId: document!.id, sharedVia: "whatsapp" });
      const { signedUrl: url } = await signedUrl.mutateAsync(document!.id);
      const phone = leadPhone?.replace(/\D/g, "") ?? "";
      const text = encodeURIComponent(`Hi ${leadName}, please find the brochure here: ${url}`);
      const waUrl = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
      await Linking.openURL(waUrl);
      onClose();
    } catch (err) {
      Alert.alert("Share failed", err instanceof Error ? err.message : "Try again");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    setBusy(true);
    try {
      const record = await share.mutateAsync({ documentId: document!.id, sharedVia: "link" });
      await Clipboard.setStringAsync(record.viewUrl);
      Alert.alert("Copied", "Tracked link copied to clipboard");
      onClose();
    } catch (err) {
      Alert.alert("Copy failed", err instanceof Error ? err.message : "Try again");
    } finally {
      setBusy(false);
    }
  }

  async function preview() {
    setBusy(true);
    try {
      const { signedUrl: url } = await signedUrl.mutateAsync(document!.id);
      await WebBrowser.openBrowserAsync(url);
      onClose();
    } catch (err) {
      Alert.alert("Preview failed", err instanceof Error ? err.message : "Try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{document.name}</Text>
          {busy ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <Pressable style={styles.action} onPress={() => void shareWhatsApp()}>
                <Ionicons name="logo-whatsapp" size={20} color={colors.primary} />
                <Text style={styles.actionText}>Share via WhatsApp</Text>
              </Pressable>
              <Pressable style={styles.action} onPress={() => void copyLink()}>
                <Ionicons name="link-outline" size={20} color={colors.primary} />
                <Text style={styles.actionText}>Copy link</Text>
              </Pressable>
              <Pressable style={styles.action} onPress={() => void preview()}>
                <Ionicons name="eye-outline" size={20} color={colors.primary} />
                <Text style={styles.actionText}>Preview</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type LeadDocumentsSectionProps = {
  leadId: string;
  leadName: string;
  leadPhone?: string | null;
};

export function LeadDocumentsSection({ leadId, leadName, leadPhone }: LeadDocumentsSectionProps) {
  const { data, isLoading, refetch } = useLeadDocuments(leadId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [actionOpen, setActionOpen] = useState(false);

  const items = data?.items ?? [];

  function viaLabel(via: LeadDocumentShare["sharedVia"]) {
    if (via === "whatsapp") return "WhatsApp";
    if (via === "email") return "Email";
    return "Link";
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Shared documents</Text>
        <Pressable style={styles.shareBtn} onPress={() => setPickerOpen(true)}>
          <Text style={styles.shareBtnText}>Share document</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : items.length === 0 ? (
        <Text style={styles.empty}>No documents shared yet.</Text>
      ) : (
        <ScrollView>
          {items.map((row) => (
            <View key={row.id} style={styles.shareRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.shareName}>{row.document.name}</Text>
                <Text style={styles.shareMeta}>
                  {row.sharer.name} · {new Date(row.sharedAt).toLocaleDateString()} ·{" "}
                  {viaLabel(row.sharedVia)}
                </Text>
              </View>
              {row.viewedAt ? (
                <View style={styles.viewedBadge}>
                  <Text style={styles.viewedText}>Viewed</Text>
                </View>
              ) : null}
            </View>
          ))}
        </ScrollView>
      )}

      <ShareDocumentSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        leadId={leadId}
        leadName={leadName}
        leadPhone={leadPhone}
        onSelectDocument={(doc) => {
          setPickerOpen(false);
          setSelectedDoc(doc);
          setActionOpen(true);
        }}
      />

      <DocumentActionSheet
        visible={actionOpen}
        document={selectedDoc}
        leadId={leadId}
        leadName={leadName}
        leadPhone={leadPhone}
        onClose={() => {
          setActionOpen(false);
          setSelectedDoc(null);
          void refetch();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  actionText: { ...typography.body, color: colors.text },
  section: { gap: spacing.md },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { ...typography.h3, color: colors.text },
  shareBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  shareBtnText: { ...typography.caption, color: colors.text, fontWeight: "700" },
  empty: { ...typography.body, color: colors.textMuted },
  shareRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  shareName: { ...typography.body, color: colors.text, fontWeight: "600" },
  shareMeta: { ...typography.caption, color: colors.textMuted },
  viewedBadge: {
    backgroundColor: "#059669",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  viewedText: { ...typography.caption, color: "#fff", fontWeight: "700" },
});
