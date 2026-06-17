import { CachedImage } from "@/components/ui/CachedImage";
import {
  formatFileSize,
  useDeleteDocument,
  useDocuments,
  useUploadDocument,
} from "@/hooks/use-documents";
import { useIsManager } from "@/hooks/use-role";
import { getApiUrl } from "@/lib/apiClient";
import { colors, radii, spacing, typography } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function fileIcon(fileType: string): keyof typeof Ionicons.glyphMap {
  if (fileType === "pdf") return "document-text-outline";
  if (fileType === "image") return "image-outline";
  return "film-outline";
}

export function DocumentsLibraryScreen() {
  const insets = useSafeAreaInsets();
  const isManager = useIsManager();
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const { data, isLoading, isError, refetch, isRefetching } = useDocuments(search || undefined);
  const upload = useUploadDocument();
  const deleteDoc = useDeleteDocument();

  const items = data?.items ?? [];

  async function pickAndUpload() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*", "video/mp4"],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const formData = new FormData();
    formData.append("file", {
      uri: asset.uri,
      name: asset.name,
      type: asset.mimeType ?? "application/octet-stream",
    } as unknown as Blob);
    formData.append("name", asset.name.replace(/\.[^.]+$/, ""));
    formData.append("isGlobal", "true");

    setUploading(true);
    try {
      await upload.mutateAsync(formData);
      await refetch();
    } catch (err) {
      Alert.alert("Upload failed", err instanceof Error ? err.message : "Try again");
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Documents</Text>
        {isManager ? (
          <Pressable
            style={styles.uploadBtn}
            onPress={() => void pickAndUpload()}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color={colors.textDark} size="small" />
            ) : (
              <Text style={styles.uploadBtnText}>Upload</Text>
            )}
          </Pressable>
        ) : null}
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search library…"
        placeholderTextColor={colors.textMutedDark}
        value={search}
        onChangeText={setSearch}
      />

      {isLoading ? (
        <ActivityIndicator color={colors.primaryLight} style={{ marginTop: spacing.lg }} />
      ) : isError ? (
        <View style={styles.empty}>
          <Text style={styles.empty}>Failed to load documents.</Text>
          <Pressable onPress={() => void refetch()}>
            <Text style={[styles.rowTitle, { color: colors.primaryLight }]}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              {item.fileType === "image" ? (
                <CachedImage
                  uri={
                    item.fileUrl.startsWith("http") ? item.fileUrl : `${getApiUrl()}${item.fileUrl}`
                  }
                  authenticated
                  cachePolicy="memory-disk"
                  style={styles.thumb}
                />
              ) : (
                <Ionicons name={fileIcon(item.fileType)} size={24} color={colors.primaryLight} />
              )}
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowMeta}>
                  {formatFileSize(item.fileSizeMb)} · {item.fileType}
                </Text>
              </View>
              {isManager ? (
                <Pressable
                  onPress={() =>
                    Alert.alert("Delete document?", item.name, [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => void deleteDoc.mutateAsync(item.id).then(() => refetch()),
                      },
                    ])
                  }
                >
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              ) : null}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No documents in library.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundDark,
    paddingHorizontal: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  title: { ...typography.h2, color: colors.textDark },
  uploadBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    minWidth: 72,
    alignItems: "center",
  },
  uploadBtnText: { ...typography.caption, color: colors.textDark, fontWeight: "700" },
  search: {
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textDark,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderDark,
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.cardDark,
  },
  rowText: { flex: 1 },
  rowTitle: { ...typography.body, color: colors.textDark, fontWeight: "600" },
  rowMeta: { ...typography.caption, color: colors.textMutedDark },
  empty: {
    ...typography.body,
    color: colors.textMutedDark,
    textAlign: "center",
    marginTop: spacing.xl,
  },
});
