import type { MessageTemplate } from "@/hooks/use-message-templates";
import {
  type RecentTemplateEntry,
  buildTemplateVariables,
  loadRecentTemplates,
  openWhatsAppWithMessage,
  previewTemplate,
  recordRecentTemplate,
} from "@/lib/whatsappTemplates";
import { colors, radii, spacing, typography } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type WhatsAppTemplateSheetProps = {
  visible: boolean;
  phone: string;
  leadName: string;
  agentName: string;
  projectName?: string | null;
  unitNumber?: string | null;
  priceListedRs?: string | null;
  templates: MessageTemplate[];
  isLoading?: boolean;
  onClose: () => void;
};

export function WhatsAppTemplateSheet({
  visible,
  phone,
  leadName,
  agentName,
  projectName,
  unitNumber,
  priceListedRs,
  templates,
  isLoading,
  onClose,
}: WhatsAppTemplateSheetProps) {
  const [recent, setRecent] = useState<RecentTemplateEntry[]>([]);
  const [customMode, setCustomMode] = useState(false);
  const [customText, setCustomText] = useState("");
  const [sending, setSending] = useState(false);

  const vars = useMemo(
    () =>
      buildTemplateVariables({
        leadName,
        agentName,
        projectName,
        unitNumber,
        priceListedRs,
      }),
    [leadName, agentName, projectName, unitNumber, priceListedRs],
  );

  useEffect(() => {
    if (!visible) return;
    setCustomMode(false);
    setCustomText("");
    void loadRecentTemplates().then(setRecent);
  }, [visible]);

  const recentTemplates = useMemo(() => {
    const byId = new Map(templates.map((t) => [t.id, t]));
    return recent
      .map((entry) => {
        const template = byId.get(entry.id);
        return template ? { entry, template } : null;
      })
      .filter((item): item is { entry: RecentTemplateEntry; template: MessageTemplate } =>
        Boolean(item),
      );
  }, [recent, templates]);

  const otherTemplates = useMemo(() => {
    const recentIds = new Set(recentTemplates.map((item) => item.template.id));
    return templates.filter((template) => !recentIds.has(template.id));
  }, [templates, recentTemplates]);

  async function sendMessage(message: string, template?: MessageTemplate) {
    const trimmed = message.trim();
    if (!trimmed) {
      Alert.alert("Empty message", "Type a message or pick a template.");
      return;
    }

    setSending(true);
    try {
      const opened = await openWhatsAppWithMessage(phone, trimmed);
      if (!opened) {
        Alert.alert(
          "WhatsApp unavailable",
          "Install WhatsApp or check that the phone number includes a valid country code.",
        );
        return;
      }
      if (template) {
        await recordRecentTemplate(template);
      }
      onClose();
    } finally {
      setSending(false);
    }
  }

  async function handleTemplatePress(template: MessageTemplate) {
    const message = previewTemplate(template.content, vars);
    await sendMessage(message, template);
  }

  function renderTemplateCard(template: MessageTemplate) {
    const preview = previewTemplate(template.content, vars);
    return (
      <Pressable
        key={template.id}
        style={styles.card}
        onPress={() => void handleTemplatePress(template)}
        disabled={sending}
      >
        <Text style={styles.cardTitle}>{template.name}</Text>
        <Text style={styles.cardPreview} numberOfLines={4}>
          {preview || template.content}
        </Text>
      </Pressable>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.sheetWrap}
      >
        <SafeAreaView edges={["bottom"]} style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Send via WhatsApp</Text>

          {isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
          ) : customMode ? (
            <View style={styles.customSection}>
              <Text style={styles.sectionLabel}>Custom message</Text>
              <TextInput
                style={styles.customInput}
                value={customText}
                onChangeText={setCustomText}
                placeholder="Type your message..."
                placeholderTextColor={colors.textMutedDark}
                multiline
              />
              <View style={styles.customActions}>
                <Pressable style={styles.secondaryBtn} onPress={() => setCustomMode(false)}>
                  <Text style={styles.secondaryBtnText}>Back</Text>
                </Pressable>
                <Pressable
                  style={[styles.primaryBtn, sending && styles.disabledBtn]}
                  onPress={() => void sendMessage(customText)}
                  disabled={sending}
                >
                  <Text style={styles.primaryBtnText}>
                    {sending ? "Opening…" : "Open WhatsApp"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {recentTemplates.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Recently used</Text>
                  {recentTemplates.map(({ template }) => renderTemplateCard(template))}
                </View>
              ) : null}

              {otherTemplates.length > 0 ? (
                <View style={styles.section}>
                  {recentTemplates.length > 0 ? (
                    <Text style={styles.sectionLabel}>All templates</Text>
                  ) : null}
                  {otherTemplates.map((template) => renderTemplateCard(template))}
                </View>
              ) : null}

              {templates.length === 0 ? (
                <Text style={styles.emptyText}>No templates available.</Text>
              ) : null}

              <Pressable style={styles.customCard} onPress={() => setCustomMode(true)}>
                <Ionicons name="create-outline" size={20} color={colors.primary} />
                <Text style={styles.customCardText}>Custom message</Text>
              </Pressable>
            </ScrollView>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheetWrap: {
    maxHeight: "78%",
  },
  sheet: {
    backgroundColor: colors.cardDark,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderDark,
    marginVertical: spacing.sm,
  },
  title: {
    ...typography.subheading,
    color: colors.textDark,
    marginBottom: spacing.sm,
  },
  list: { maxHeight: 480 },
  section: { marginBottom: spacing.md },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMutedDark,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.backgroundDark,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textDark,
    marginBottom: 4,
  },
  cardPreview: {
    fontSize: 13,
    color: colors.textMutedDark,
    lineHeight: 18,
  },
  customCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 14,
    marginTop: spacing.xs,
  },
  customCardText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 15,
  },
  emptyText: {
    color: colors.textMutedDark,
    textAlign: "center",
    marginVertical: spacing.md,
  },
  customSection: { gap: spacing.sm },
  customInput: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.textDark,
    fontSize: 15,
    textAlignVertical: "top",
    backgroundColor: colors.backgroundDark,
  },
  customActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: "#128C7E",
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  secondaryBtn: {
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
    justifyContent: "center",
  },
  secondaryBtnText: { color: colors.textDark, fontWeight: "600" },
  disabledBtn: { opacity: 0.6 },
});
