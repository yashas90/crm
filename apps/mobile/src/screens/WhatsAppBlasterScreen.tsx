import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useIsAdmin } from "@/hooks/use-role";
import { useParseWhatsAppFile, useWhatsAppCampaigns } from "@/hooks/use-whatsapp-blaster";
import { colors, spacing, typography } from "@/theme";
import { TAB_BAR_SCROLL_PADDING } from "@/theme/layout";
import * as DocumentPicker from "expo-document-picker";
import { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

async function uriToBase64(uri: string) {
  const response = await fetch(uri);
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",")[1]! : result);
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(blob);
  });
}

export function WhatsAppBlasterScreen() {
  const insets = useSafeAreaInsets();
  const isAdmin = useIsAdmin();
  const parse = useParseWhatsAppFile();
  const campaigns = useWhatsAppCampaigns(isAdmin);
  const [summary, setSummary] = useState<string | null>(null);

  async function pickContacts() {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        "text/csv",
        "text/comma-separated-values",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "*/*",
      ],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    try {
      const fileBase64 = await uriToBase64(asset.uri);
      const parsed = await parse.mutateAsync({ fileBase64, fileName: asset.name });
      setSummary(
        `${parsed.total} contacts loaded\n${parsed.valid} valid | ${parsed.invalid} invalid | ${parsed.duplicates} duplicates`,
      );
    } catch (err) {
      Alert.alert("Parse failed", err instanceof Error ? err.message : "Try a CSV or Excel file");
    }
  }

  if (!isAdmin) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: TAB_BAR_SCROLL_PADDING + insets.bottom,
        }}
      >
        <Text style={styles.title}>WhatsApp Blaster</Text>
        <Text style={styles.sub}>Only admins can access WhatsApp Blaster.</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        padding: spacing.md,
        paddingBottom: TAB_BAR_SCROLL_PADDING + insets.bottom,
      }}
    >
      <Text style={styles.title}>WhatsApp Blaster</Text>
      <Text style={styles.sub}>
        Upload a CSV/Excel list, then finish campaign setup on web if needed. Sending respects Safe
        (3s) rate limits.
      </Text>
      <Button
        label={parse.isPending ? "Parsing…" : "Upload CSV / Excel"}
        onPress={() => void pickContacts()}
        loading={parse.isPending}
      />
      {summary ? (
        <Card style={styles.card}>
          <Text style={styles.summary}>{summary}</Text>
        </Card>
      ) : null}
      <Text style={styles.section}>Campaigns</Text>
      {campaigns.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {(campaigns.data?.items ?? []).map((c) => (
        <Card key={String(c.id)} style={styles.card}>
          <Text style={styles.campaign}>
            {String(c.campaignCode)} · {String(c.name)}
          </Text>
          <Text style={styles.meta}>
            {String(c.status)} · sent {String(c.sentCount)}/{String(c.totalContacts)} · interested{" "}
            {String(c.interestedCount)}
          </Text>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: { ...typography.heading, color: colors.text, marginBottom: 6 },
  sub: { color: colors.textMuted, marginBottom: spacing.md, lineHeight: 20 },
  section: {
    ...typography.subheading,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  card: { marginTop: spacing.sm, padding: spacing.md },
  summary: { color: colors.text, lineHeight: 20 },
  campaign: { color: colors.text, fontWeight: "700" },
  meta: { color: colors.textMuted, marginTop: 4, fontSize: 12 },
});
