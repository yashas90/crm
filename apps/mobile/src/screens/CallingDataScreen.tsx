import { apiGet, apiPost } from "@/lib/apiClient";
import { dialPhoneNumber } from "@/lib/phoneActions";
import type { MainTabParamList } from "@/navigation/types";
import { colors, radii, spacing, typography } from "@/theme";
import { TAB_BAR_SCROLL_PADDING } from "@/theme/layout";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type CallingRow = {
  recordId: string;
  name: string;
  phone: string;
  city: string | null;
  budget: string | null;
  propertyType: string | null;
  bedrooms: string | null;
  status: string;
  callAttempts: number;
  assignedAt: string;
  callbackScheduledAt: string | null;
};

type DailyStatus = {
  contactsRequestedToday: number;
  maxDailyLimit: number;
  remaining: number;
  paused: boolean;
  resetsAt: string;
};

const OUTCOMES = [
  ["interested", "Interested"],
  ["not_interested", "Not Interested"],
  ["callback", "Schedule Callback"],
  ["no_answer", "No Answer"],
  ["busy", "Busy"],
  ["invalid", "Invalid"],
  ["dnc", "DNC"],
] as const;

const CITIES = ["", "Bangalore", "Mumbai", "Delhi", "Hyderabad", "Chennai", "Pune"];

export function CallingDataScreen(_props: BottomTabScreenProps<MainTabParamList, "CallingTab">) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [propertyType, setPropertyType] = useState<string | null>(null);
  const [active, setActive] = useState<CallingRow | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [callbackAt, setCallbackAt] = useState(new Date(Date.now() + 60 * 60 * 1000));
  const [showPicker, setShowPicker] = useState<"date" | "time" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const status = useQuery({
    queryKey: ["calling-daily-status"],
    queryFn: () => apiGet<DailyStatus>("/api/agent/daily-status"),
  });
  const stats = useQuery({
    queryKey: ["calling-stats"],
    queryFn: () =>
      apiGet<{ remaining: number; pending: number; retry: number; callbacks: number }>(
        "/api/agent/calling-data/stats",
      ),
  });
  const list = useQuery({
    queryKey: ["calling-data", search],
    queryFn: () =>
      apiGet<CallingRow[]>(
        `/api/agent/calling-data${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ""}`,
      ),
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const request = useMutation({
    mutationFn: () =>
      apiPost<{
        status: string;
        contactsAssigned: number;
        denialReason: string | null;
        alreadyLeads: { message: string }[];
      }>("/api/agent/request-data", {
        city: city || null,
        propertyType,
      }),
    onSuccess: async (data) => {
      setMessage(
        data.denialReason ??
          `${data.contactsAssigned} contacts assigned.${data.alreadyLeads?.[0] ? ` ${data.alreadyLeads[0].message}` : ""}`,
      );
      await queryClient.invalidateQueries({ queryKey: ["calling-data"] });
      await queryClient.invalidateQueries({ queryKey: ["calling-stats"] });
      await queryClient.invalidateQueries({ queryKey: ["calling-daily-status"] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Request failed"),
  });

  const save = useMutation({
    mutationFn: () => {
      if (!active || !outcome) throw new Error("Choose an outcome");
      return apiPost<{ message: string; leadCode: string | null }>("/api/agent/log-outcome", {
        record_id: active.recordId,
        outcome,
        notes: notes || null,
        callback_time: outcome === "callback" ? callbackAt.toISOString() : null,
      });
    },
    onSuccess: async (data) => {
      setMessage(data.leadCode ? `Lead ${data.leadCode} created` : data.message);
      setActive(null);
      setOutcome(null);
      setNotes("");
      await queryClient.invalidateQueries({ queryKey: ["calling-data"] });
      await queryClient.invalidateQueries({ queryKey: ["calling-stats"] });
      await queryClient.invalidateQueries({ queryKey: ["my-leads"] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Could not save"),
  });

  const remainingToday = status.data?.remaining ?? 0;
  const limitReached = remainingToday <= 0 || status.data?.paused;
  const resetMs = status.data ? new Date(status.data.resetsAt).getTime() - now : 0;
  const countdown = formatCountdown(Math.max(0, resetMs));
  const rows = list.data ?? [];
  const headerCounts = useMemo(
    () => ({
      pending: stats.data?.pending ?? rows.filter((row) => row.status === "pending").length,
      retry: stats.data?.retry ?? rows.filter((row) => row.status === "retry").length,
      callbacks: stats.data?.callbacks ?? rows.filter((row) => row.status === "callback").length,
    }),
    [rows, stats.data],
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.recordId}
        contentContainerStyle={{
          paddingBottom: TAB_BAR_SCROLL_PADDING,
          paddingHorizontal: spacing.md,
        }}
        ListHeaderComponent={
          <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
            <Text style={styles.title}>
              Calling Data — {stats.data?.remaining ?? rows.length} contacts remaining
            </Text>
            <Text style={styles.sub}>
              Pending {headerCounts.pending} · Retry {headerCounts.retry} · Callbacks{" "}
              {headerCounts.callbacks}
            </Text>
            <Text style={styles.sub}>
              You have requested {status.data?.contactsRequestedToday ?? 0}/
              {status.data?.maxDailyLimit ?? 100} contacts today
            </Text>
            <Text style={styles.sub}>{remainingToday} more available today</Text>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${Math.min(100, ((status.data?.contactsRequestedToday ?? 0) / (status.data?.maxDailyLimit || 100)) * 100)}%`,
                  },
                ]}
              />
            </View>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search this calling list"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
            <View style={styles.row}>
              {CITIES.map((item) => (
                <Pressable key={item || "any"} onPress={() => setCity(item)} style={styles.chip}>
                  <Text style={styles.chipText}>{item || "Any city"}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.row}>
              {["apartment", "villa", "plot"].map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setPropertyType(propertyType === item ? null : item)}
                  style={styles.chip}
                >
                  <Text style={styles.chipText}>{item}</Text>
                </Pressable>
              ))}
            </View>
            {limitReached ? (
              <Text style={styles.warn}>
                {status.data?.paused
                  ? "Data requests are paused."
                  : `Daily limit reached. Resets at midnight. ${countdown}`}
              </Text>
            ) : (
              <Pressable style={styles.primary} onPress={() => request.mutate()}>
                <Text style={styles.primaryText}>
                  Request {Math.min(100, remainingToday)} Contacts
                </Text>
              </Pressable>
            )}
            {message ? <Text style={styles.sub}>{message}</Text> : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.phone}>{item.phone}</Text>
            <Text style={styles.sub}>
              {[item.city, item.budget, item.propertyType, item.bedrooms]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            <Text style={styles.badge}>
              {labelFor(item.status)} · attempt {item.callAttempts}/3 · {timeSince(item.assignedAt)}
            </Text>
            <Pressable
              style={styles.call}
              onPress={() => {
                void dialPhoneNumber(item.phone);
                setActive(item);
                setOutcome(null);
                setNotes("");
              }}
            >
              <Text style={styles.primaryText}>Call</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.sub}>No calling contacts yet. Request data above.</Text>
        }
      />

      <Modal visible={active != null} animationType="slide" onRequestClose={() => undefined}>
        <View style={[styles.modal, { paddingTop: insets.top + spacing.md }]}>
          <Text style={styles.title}>How did the call go?</Text>
          <Text style={styles.sub}>
            {active?.name} · {active?.phone}
          </Text>
          <Text style={styles.warn}>Choose an outcome to continue. This cannot be skipped.</Text>
          {OUTCOMES.map(([value, label]) => (
            <Pressable key={value} onPress={() => setOutcome(value)} style={styles.option}>
              <Text style={[styles.chipText, outcome === value && styles.selected]}>{label}</Text>
            </Pressable>
          ))}
          {outcome === "callback" ? (
            <View style={{ gap: spacing.sm }}>
              <Pressable onPress={() => setShowPicker("date")}>
                <Text style={styles.sub}>Date {callbackAt.toLocaleDateString()}</Text>
              </Pressable>
              <Pressable onPress={() => setShowPicker("time")}>
                <Text style={styles.sub}>Time {callbackAt.toLocaleTimeString()}</Text>
              </Pressable>
              {showPicker ? (
                <DateTimePicker
                  value={callbackAt}
                  mode={showPicker}
                  onChange={(_event, selected) => {
                    if (selected) setCallbackAt(selected);
                    setShowPicker(null);
                  }}
                />
              ) : null}
            </View>
          ) : null}
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Notes (optional)"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <Pressable
            style={[styles.primary, !outcome && styles.disabled]}
            disabled={!outcome || save.isPending}
            onPress={() => save.mutate()}
          >
            <Text style={styles.primaryText}>Save Outcome</Text>
          </Pressable>
          {message ? <Text style={styles.sub}>{message}</Text> : null}
        </View>
      </Modal>
    </View>
  );
}

function labelFor(status: string) {
  if (status === "pending") return "Not Called";
  if (status === "callback") return "Callback";
  if (status === "retry") return "Retry";
  return status;
}

function timeSince(iso: string) {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatCountdown(ms: number) {
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  title: { ...typography.h2, color: colors.text },
  name: { ...typography.h3, color: colors.text },
  phone: { color: colors.text, fontSize: 16, marginTop: 2 },
  sub: { color: colors.textMuted, fontSize: 13 },
  warn: { color: colors.warning, fontSize: 14 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: 4,
  },
  badge: { color: colors.primaryLight, fontSize: 12, fontWeight: "600" },
  primary: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  call: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "700" },
  disabled: { opacity: 0.4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    color: colors.text,
    padding: spacing.sm,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: { color: colors.text, fontSize: 13 },
  selected: { color: colors.primaryLight, fontWeight: "700" },
  track: { height: 8, backgroundColor: colors.border, borderRadius: 99, overflow: "hidden" },
  fill: { height: 8, backgroundColor: colors.primary },
  modal: { flex: 1, backgroundColor: colors.background, padding: spacing.md, gap: spacing.sm },
  option: { paddingVertical: 8 },
});
