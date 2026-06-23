import {
  type Document,
  formatFileSize,
  useDocumentSignedUrl,
  useDocuments,
  useShareDocument,
} from "@/hooks/use-documents";
import { colors, radii, spacing, typography } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type ShareDocumentSheetProps = {
  visible: boolean;
  onClose: () => void;
  leadId: string;
  leadName: string;
  leadPhone?: string | null;
  onSelectDocument: (document: Document) => void;
};

function fileIcon(fileType: Document["fileType"]): keyof typeof Ionicons.glyphMap {
  if (fileType === "pdf") return "document-text-outline";
  if (fileType === "image") return "image-outline";
  return "film-outline";
}

export function ShareDocumentSheet({
  visible,
  onClose,
  leadId: _leadId,
  leadName,
  onSelectDocument,
}: ShareDocumentSheetProps) {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useDocuments(search || undefined);
  const items = useMemo(() => data?.items ?? [], [data?.items]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Share document</Text>
            <Text style={styles.subtitle}>with {leadName}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          <TextInput
            style={styles.search}
            placeholder="Search library…"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />

          {isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: spacing.xl }}
              renderItem={({ item }) => (
                <Pressable style={styles.row} onPress={() => onSelectDocument(item)}>
                  <Ionicons name={fileIcon(item.fileType)} size={22} color={colors.primary} />
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{item.name}</Text>
                    <Text style={styles.rowMeta}>
                      {formatFileSize(item.fileSizeMb)} · {item.fileType}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.empty}>No documents in library.</Text>}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    maxHeight: "80%",
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  title: { ...typography.h3, color: colors.text, flex: 1 },
  subtitle: { ...typography.caption, color: colors.textMuted, flex: 1 },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowText: { flex: 1 },
  rowTitle: { ...typography.body, color: colors.text, fontWeight: "600" },
  rowMeta: { ...typography.caption, color: colors.textMuted },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.lg,
  },
});
