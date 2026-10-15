import { apiGet, apiPost } from "@/lib/apiClient";
import {
  CALLING_LIST_QUERY,
  CALLING_QUEUE_QUERY,
  applyOutcomeToCallingRows,
  callingListRestoreOffset,
  resolveDisplayedCallingRows,
} from "@/lib/callingQueueList";
import { FLAT_LIST_PERF } from "@/lib/flatList";
import { dialPhoneNumber } from "@/lib/phoneActions";
import type { MainTabParamList } from "@/navigation/types";
import { colors, radii, spacing, typography } from "@/theme";
import { TAB_BAR_SCROLL_PADDING } from "@/theme/layout";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AppState,
  FlatList,
  Keyboard,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
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

/** Same array every render so FlatList does not treat "no rows yet" as new data. */
const EMPTY_CALLING_ROWS: CallingRow[] = [];

type CallingStats = {
  remaining: number;
  pending: number;
  retry: number;
  callbacks: number;
  badge?: number;
};

type HeaderModel = {
  remainingLabel: number;
  pending: number;
  retry: number;
  callbacks: number;
  contactsRequestedToday: number;
  maxDailyLimit: number;
  remainingToday: number;
  paused: boolean;
  resetsAt: string | null;
  limitReached: boolean;
  search: string;
  onSearch: (value: string) => void;
  onCity: (value: string) => void;
  propertyType: string | null;
  onPropertyType: (value: string | null) => void;
  onRequest: () => void;
  message: string | null;
};

const CallingHeaderContext = createContext<HeaderModel | null>(null);

/** Stable type so a stats tick cannot swap the FlatList header element (Android jumps to top). */
function CallingDataListHeader() {
  const model = useContext(CallingHeaderContext);
  if (!model) return null;
  return <CallingListHeader {...model} />;
}

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

  const listRef = useRef<FlatList<CallingRow>>(null);
  const scrollOffsetRef = useRef(0);
  const heldOffsetRef = useRef<number | null>(null);
  const displayedRef = useRef<readonly CallingRow[]>(EMPTY_CALLING_ROWS);
  const searchRef = useRef(search);
  const activeRef = useRef(active);
  searchRef.current = search;
  activeRef.current = active;

  const status = useQuery({
    queryKey: ["calling-daily-status"],
    queryFn: () => apiGet<DailyStatus>("/api/agent/daily-status"),
    ...CALLING_LIST_QUERY,
  });
  const stats = useQuery({
    queryKey: ["calling-stats"],
    queryFn: () => apiGet<CallingStats>("/api/agent/calling-data/stats"),
    ...CALLING_QUEUE_QUERY,
  });
  const list = useQuery({
    queryKey: ["calling-data", search],
    queryFn: () =>
      apiGet<CallingRow[]>(
        `/api/agent/calling-data${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ""}`,
      ),
    placeholderData: keepPreviousData,
    ...CALLING_LIST_QUERY,
  });

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
      // Explicit reload only. invalidateQueries is a no-op on the static list query.
      await Promise.all([list.refetch(), stats.refetch(), status.refetch()]);
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Request failed"),
  });

  const save = useMutation({
    mutationFn: () => {
      if (!active || !outcome) throw new Error("Choose an outcome");
      return apiPost<{
        message: string;
        leadCode: string | null;
        removed?: boolean;
        callingStatus?: string;
        callAttempts?: number;
      }>("/api/agent/log-outcome", {
        record_id: active.recordId,
        outcome,
        notes: notes || null,
        callback_time: outcome === "callback" ? callbackAt.toISOString() : null,
      });
    },
    onSuccess: async (data) => {
      const row = activeRef.current;
      const queueKey = ["calling-data", searchRef.current] as const;
      setMessage(data.leadCode ? `Lead ${data.leadCode} created` : data.message);
      if (row) {
        queryClient.setQueryData<CallingRow[]>(queueKey, (current) => {
          const next = applyOutcomeToCallingRows(current, row.recordId, data);
          return next ? [...next] : current;
        });
        const rowsNow = queryClient.getQueryData<CallingRow[]>(queueKey);
        if (rowsNow) {
          queryClient.setQueryData<CallingStats>(["calling-stats"], (current) =>
            statsFromRows(rowsNow, current),
          );
        }
      }
      setActive(null);
      setOutcome(null);
      setNotes("");
      await queryClient.invalidateQueries({ queryKey: ["my-leads"] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Could not save"),
  });

  const callInProgress = active != null;
  const incoming = list.data ?? EMPTY_CALLING_ROWS;
  const rows = resolveDisplayedCallingRows(displayedRef.current, incoming, callInProgress);
  displayedRef.current = rows;

  const remainingToday = status.data?.remaining ?? 0;
  const limitReached = remainingToday <= 0 || Boolean(status.data?.paused);
  const headerCounts = useMemo(
    () => ({
      pending: stats.data?.pending ?? rows.filter((row) => row.status === "pending").length,
      retry: stats.data?.retry ?? rows.filter((row) => row.status === "retry").length,
      callbacks: stats.data?.callbacks ?? rows.filter((row) => row.status === "callback").length,
    }),
    [rows, stats.data],
  );

  const onRequest = useCallback(() => {
    request.mutate();
  }, [request.mutate]);

  const liveHeader = useMemo<HeaderModel>(
    () => ({
      remainingLabel: stats.data?.remaining ?? rows.length,
      pending: headerCounts.pending,
      retry: headerCounts.retry,
      callbacks: headerCounts.callbacks,
      contactsRequestedToday: status.data?.contactsRequestedToday ?? 0,
      maxDailyLimit: status.data?.maxDailyLimit ?? 200,
      remainingToday,
      paused: Boolean(status.data?.paused),
      resetsAt: status.data?.resetsAt ?? null,
      limitReached,
      search,
      onSearch: setSearch,
      onCity: setCity,
      propertyType,
      onPropertyType: setPropertyType,
      onRequest,
      message,
    }),
    [
      headerCounts,
      limitReached,
      message,
      onRequest,
      propertyType,
      remainingToday,
      rows.length,
      search,
      stats.data?.remaining,
      status.data?.contactsRequestedToday,
      status.data?.maxDailyLimit,
      status.data?.paused,
      status.data?.resetsAt,
    ],
  );
  const frozenHeaderRef = useRef(liveHeader);
  if (!callInProgress) frozenHeaderRef.current = liveHeader;
  const headerModel = callInProgress ? frozenHeaderRef.current : liveHeader;

  const onCallRow = useCallback((item: CallingRow) => {
    heldOffsetRef.current = scrollOffsetRef.current;
    Keyboard.dismiss();
    void dialPhoneNumber(item.phone);
    setActive(item);
    setOutcome(null);
    setNotes("");
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: CallingRow }) => <CallingRowCard item={item} onCall={onCallRow} />,
    [onCallRow],
  );

  const contentContainerStyle = useMemo(
    () => ({
      paddingBottom: TAB_BAR_SCROLL_PADDING + insets.bottom,
      paddingHorizontal: spacing.md,
    }),
    [insets.bottom],
  );

  const [userRefreshing, setUserRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setUserRefreshing(true);
    void Promise.all([list.refetch(), stats.refetch(), status.refetch()]).finally(() => {
      setUserRefreshing(false);
    });
  }, [list.refetch, stats.refetch, status.refetch]);

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={userRefreshing}
        onRefresh={onRefresh}
        tintColor={colors.primary}
      />
    ),
    [onRefresh, userRefreshing],
  );

  const onListScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
  }, []);

  useEffect(() => {
    if (!callInProgress) return;
    void queryClient.cancelQueries({ queryKey: ["calling-data"] });
    void queryClient.cancelQueries({ queryKey: ["calling-daily-status"] });
  }, [callInProgress, queryClient]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "background" || next === "inactive") Keyboard.dismiss();
    });
    return () => sub.remove();
  }, []);

  useLayoutEffect(() => {
    const offset = callingListRestoreOffset(callInProgress, heldOffsetRef.current);
    if (offset == null) return;
    heldOffsetRef.current = null;
    listRef.current?.scrollToOffset({ offset, animated: false });
  }, [callInProgress]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <CallingHeaderContext.Provider value={headerModel}>
        <FlatList
          ref={listRef}
          testID="calling-data-list"
          data={rows}
          extraData={headerModel}
          keyExtractor={callingRowKey}
          contentContainerStyle={contentContainerStyle}
          ListHeaderComponent={CallingDataListHeader}
          renderItem={renderItem}
          refreshControl={refreshControl}
          ListEmptyComponent={CallingListEmpty}
          onScroll={onListScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          {...FLAT_LIST_PERF}
          removeClippedSubviews={false}
        />
      </CallingHeaderContext.Provider>

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

function callingRowKey(item: CallingRow) {
  return item.recordId;
}

function statsFromRows(
  rows: readonly CallingRow[],
  previous: CallingStats | undefined,
): CallingStats {
  const pending = rows.filter((row) => row.status === "pending").length;
  const retry = rows.filter((row) => row.status === "retry").length;
  const callbacks = rows.filter((row) => row.status === "callback").length;
  return {
    ...previous,
    remaining: rows.length,
    pending,
    retry,
    callbacks,
    badge: pending + callbacks,
  };
}

function CallingListEmpty() {
  return <Text style={styles.sub}>No calling contacts yet. Request data above.</Text>;
}

function CallingListHeader({
  remainingLabel,
  pending,
  retry,
  callbacks,
  contactsRequestedToday,
  maxDailyLimit,
  remainingToday,
  paused,
  resetsAt,
  limitReached,
  search,
  onSearch,
  onCity,
  propertyType,
  onPropertyType,
  onRequest,
  message,
}: {
  remainingLabel: number;
  pending: number;
  retry: number;
  callbacks: number;
  contactsRequestedToday: number;
  maxDailyLimit: number;
  remainingToday: number;
  paused: boolean;
  resetsAt: string | null;
  limitReached: boolean;
  search: string;
  onSearch: (value: string) => void;
  onCity: (value: string) => void;
  propertyType: string | null;
  onPropertyType: (value: string | null) => void;
  onRequest: () => void;
  message: string | null;
}) {
  const requested = contactsRequestedToday;
  const limit = maxDailyLimit || 200;
  return (
    <View style={styles.header}>
      <Text style={styles.title}>Calling Data — {remainingLabel} contacts remaining</Text>
      <Text style={styles.sub}>
        Pending {pending} · Retry {retry} · Callbacks {callbacks}
      </Text>
      <Text style={styles.sub}>
        You have requested {requested}/{limit} contacts today
      </Text>
      <Text style={styles.sub}>{remainingToday} more available today</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(100, (requested / limit) * 100)}%` }]} />
      </View>
      <TextInput
        value={search}
        onChangeText={onSearch}
        placeholder="Search this calling list"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />
      <View style={styles.row}>
        {CITIES.map((item) => (
          <Pressable key={item || "any"} onPress={() => onCity(item)} style={styles.chip}>
            <Text style={styles.chipText}>{item || "Any city"}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.row}>
        {["apartment", "villa", "plot"].map((item) => (
          <Pressable
            key={item}
            onPress={() => onPropertyType(propertyType === item ? null : item)}
            style={styles.chip}
          >
            <Text style={styles.chipText}>{item}</Text>
          </Pressable>
        ))}
      </View>
      {paused ? (
        <Text style={styles.warn}>Data requests are paused.</Text>
      ) : limitReached && resetsAt ? (
        <DailyResetCountdown resetsAt={resetsAt} />
      ) : (
        <Pressable style={styles.primary} onPress={onRequest}>
          <Text style={styles.primaryText}>Request {Math.min(limit, remainingToday)} Contacts</Text>
        </Pressable>
      )}
      {message ? <Text style={styles.sub}>{message}</Text> : null}
    </View>
  );
}

function CallingRowCard({
  item,
  onCall,
}: {
  item: CallingRow;
  onCall: (item: CallingRow) => void;
}) {
  // Freeze the relative time so a parent re-render cannot change row height and shove the list.
  const [assignedLabel] = useState(() => timeSince(item.assignedAt));
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.phone}>{item.phone}</Text>
      <Text style={styles.sub}>
        {[item.city, item.budget, item.propertyType, item.bedrooms].filter(Boolean).join(" · ")}
      </Text>
      <Text style={styles.badge}>
        {labelFor(item.status)} · attempt {item.callAttempts}/3 · {assignedLabel}
      </Text>
      <Pressable style={styles.call} onPress={() => onCall(item)}>
        <Text style={styles.primaryText}>Call</Text>
      </Pressable>
    </View>
  );
}

function DailyResetCountdown({ resetsAt }: { resetsAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const resetMs = Math.max(0, new Date(resetsAt).getTime() - now);
  return (
    <Text style={styles.warn} numberOfLines={1}>
      Daily limit reached. Resets at midnight. {formatCountdown(resetMs)}
    </Text>
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
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { gap: spacing.sm, marginBottom: spacing.md },
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
