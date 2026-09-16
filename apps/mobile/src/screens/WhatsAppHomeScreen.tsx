import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useIsAdmin } from "@/hooks/use-role";
import {
  useReplyWhatsApp,
  useWhatsAppInbox,
  useWhatsAppLeads,
  useWhatsAppUnreadCount,
} from "@/hooks/use-whatsapp-blaster";
import { apiGet } from "@/lib/apiClient";
import type { ProfileStackParamList } from "@/navigation/types";
import { colors, spacing, typography } from "@/theme";
import { TAB_BAR_SCROLL_PADDING } from "@/theme/layout";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Tab = "blaster" | "inbox" | "leads" | "campaigns";

export function WhatsAppHomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const insets = useSafeAreaInsets();
  const isAdmin = useIsAdmin();
  const [tab, setTab] = useState<Tab>("inbox");
  const unread = useWhatsAppUnreadCount(isAdmin);
  const inbox = useWhatsAppInbox(isAdmin);
  const leads = useWhatsAppLeads(isAdmin);
  const reply = useReplyWhatsApp();
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [thread, setThread] = useState<Array<{ id: string; direction: string; content: string }>>(
    [],
  );

  async function openThread(id: string) {
    setSelected(id);
    const data = await apiGet<{ items: Array<{ id: string; direction: string; content: string }> }>(
      `/api/whatsapp/blaster/inbox/${id}`,
    );
    setThread(data.items);
  }

  if (!isAdmin) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>WhatsApp</Text>
        <Text style={styles.meta}>Only admins can access WhatsApp Blaster.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <Text style={styles.title}>WhatsApp</Text>
      <View style={styles.tabs}>
        {(
          [
            ["blaster", "Blaster"],
            ["inbox", `Inbox${unread.data?.count ? ` (${unread.data.count})` : ""}`],
            ["leads", "WA Leads"],
            ["campaigns", "Campaigns"],
          ] as const
        ).map(([id, label]) => (
          <Pressable
            key={id}
            onPress={() =>
              id === "blaster" ? navigation.navigate("WhatsAppBlasterScreen") : setTab(id)
            }
            style={[styles.tab, tab === id && styles.tabOn]}
          >
            <Text style={[styles.tabText, tab === id && styles.tabTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_SCROLL_PADDING + insets.bottom }}>
        {tab === "inbox"
          ? (inbox.data?.items ?? []).map((item) => (
              <Pressable key={item.id} onPress={() => void openThread(item.id)}>
                <Card style={styles.card}>
                  <Text style={styles.name}>
                    {item.name} · {item.phone}
                  </Text>
                  <Text style={styles.meta}>
                    {item.campaignName} · {item.status}
                    {item.unreadCount ? ` · ${item.unreadCount} unread` : ""}
                  </Text>
                </Card>
              </Pressable>
            ))
          : null}
        {tab === "inbox" && selected ? (
          <Card style={styles.card}>
            {thread.map((msg) => (
              <Text key={msg.id} style={styles.msg}>
                {msg.direction === "outbound" ? "You: " : "Them: "}
                {msg.content}
              </Text>
            ))}
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="Reply"
              placeholderTextColor={colors.textMuted}
            />
            <Button
              label="Send"
              onPress={() => {
                if (!text.trim()) return;
                void reply
                  .mutateAsync({ contactId: selected, text })
                  .then(() => {
                    setText("");
                    return openThread(selected);
                  })
                  .catch(() =>
                    Alert.alert(
                      "Queued",
                      "No connection — reply will send when you're back online.",
                    ),
                  );
              }}
            />
          </Card>
        ) : null}
        {tab === "leads"
          ? (leads.data?.items ?? []).map((lead) => (
              <Card key={lead.id} style={styles.card}>
                <Text style={styles.name}>
                  {lead.leadCode} · {lead.name}
                </Text>
                <Text style={styles.meta}>{lead.contactPhone}</Text>
                <Text style={styles.meta}>
                  {[lead.budgetAnswer, lead.locationAnswer, lead.timelineAnswer]
                    .filter(Boolean)
                    .join(" · ") || "Awaiting questions"}
                </Text>
                <Button
                  label="Call now"
                  variant="secondary"
                  onPress={() => void Linking.openURL(`tel:${lead.contactPhone}`)}
                />
              </Card>
            ))
          : null}
        {tab === "campaigns" ? (
          <Text style={styles.meta}>Open Blaster for campaign upload and live stats.</Text>
        ) : null}
        {tab === "inbox" && (inbox.data?.items.length ?? 0) === 0 ? (
          <Text style={styles.meta}>No replies yet.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  title: { ...typography.heading, color: colors.text, marginBottom: spacing.sm },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: spacing.md },
  tab: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tabOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.textMuted, fontWeight: "700", fontSize: 12 },
  tabTextOn: { color: "#fff" },
  card: { marginBottom: spacing.sm, padding: spacing.md, gap: 6 },
  name: { color: colors.text, fontWeight: "700" },
  meta: { color: colors.textMuted, fontSize: 12 },
  msg: { color: colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
});
