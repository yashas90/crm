import { DialPadKeypad } from "@/components/dialer/DialPadKeypad";
import { LinkLeadPickerModal } from "@/components/dialer/LinkLeadPickerModal";
import { PostCallActionModal } from "@/components/dialer/PostCallActionModal";
import { useLogCall } from "@/hooks/use-calls";
import type { LeadRow } from "@/hooks/use-leads";
import { useCallDurationTracking } from "@/hooks/useCallDurationTracking";
import { apiGet } from "@/lib/apiClient";
import { dialPhoneNumber, normalizeTelPhone } from "@/lib/phoneActions";
import type { MainTabParamList } from "@/navigation/types";
import { colors, radii, spacing, typography } from "@/theme";
import { TAB_BAR_SCROLL_PADDING } from "@/theme/layout";
import type { CallOutcome } from "@propninja/types/enums";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = BottomTabScreenProps<MainTabParamList, "DialPadTab">;

type PendingCall = {
  phoneNumber: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
};

function inferOutcome(durationSeconds: number): CallOutcome {
  if (durationSeconds <= 0) return "no_answer";
  return "answered";
}

export function DialPadScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [digits, setDigits] = useState("");
  const [calling, setCalling] = useState(false);
  const callStartRef = useRef<number | null>(null);
  const matchedLeadIdRef = useRef<string | undefined>(undefined);
  const [pendingCall, setPendingCall] = useState<PendingCall | null>(null);
  const [outcome, setOutcome] = useState<CallOutcome>("answered");
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);

  const logCall = useLogCall();
  const normalizedPhone = useMemo(() => normalizeTelPhone(digits), [digits]);
  const displayPhone = digits || "Enter number";

  const lookupEnabled = normalizedPhone.replace(/\D/g, "").length >= 10;
  const lookupQuery = useQuery({
    queryKey: ["leads", "lookup-phone", normalizedPhone],
    queryFn: () =>
      apiGet<LeadRow | null>(
        `/api/leads/lookup-phone?phone=${encodeURIComponent(normalizedPhone)}`,
      ),
    enabled: lookupEnabled,
    staleTime: 30_000,
  });

  const matchedLead = lookupQuery.data ?? null;

  const openPostCall = useCallback((startMs: number, phone: string) => {
    const endedAt = new Date();
    const durationSeconds = Math.max(0, Math.round((endedAt.getTime() - startMs) / 1000));
    const inferred = inferOutcome(durationSeconds);
    setOutcome(inferred);
    setPendingCall({
      phoneNumber: phone,
      startedAt: new Date(startMs).toISOString(),
      endedAt: endedAt.toISOString(),
      durationSeconds,
    });
    setCalling(false);
    callStartRef.current = null;
  }, []);

  const { beginCall, clearCallSession } = useCallDurationTracking({
    onReturn: ({ calledAt }) => {
      const startMs = new Date(calledAt).getTime();
      const phone = normalizeTelPhone(digits);
      if (!phone) return;
      openPostCall(startMs, phone);
    },
  });

  const appendDigit = useCallback(
    (key: string) => {
      if (calling) return;
      setDigits((prev) => `${prev}${key}`.slice(0, 16));
    },
    [calling],
  );

  const backspace = useCallback(() => {
    if (calling) return;
    setDigits((prev) => prev.slice(0, -1));
  }, [calling]);

  const onLongPressZero = useCallback(() => {
    setDigits((prev) => (prev.startsWith("+") ? prev : `+${prev}`));
  }, []);

  const startCall = useCallback(async () => {
    const phone = normalizeTelPhone(digits);
    if (!phone || phone.replace(/\D/g, "").length < 10) return;

    const opened = await dialPhoneNumber(phone);
    if (!opened) return;

    const startMs = Date.now();
    callStartRef.current = startMs;
    matchedLeadIdRef.current = matchedLead?.id;
    setCalling(true);
    beginCall({
      leadId: matchedLead?.id ?? "",
      leadName: matchedLead ? `${matchedLead.firstName} ${matchedLead.lastName}`.trim() : phone,
      phoneNumber: phone,
    });
  }, [beginCall, digits, matchedLead]);

  const endCallTracking = useCallback(() => {
    const startMs = callStartRef.current;
    const phone = normalizeTelPhone(digits);
    if (startMs && phone) {
      openPostCall(startMs, phone);
    } else {
      setCalling(false);
    }
    clearCallSession();
  }, [clearCallSession, digits, openPostCall]);

  const submitCallLog = useCallback(
    async (leadId?: string) => {
      if (!pendingCall) return;
      await logCall.mutateAsync({
        phone_number: pendingCall.phoneNumber,
        lead_id: leadId,
        direction: "outgoing",
        started_at: pendingCall.startedAt,
        ended_at: pendingCall.endedAt,
        duration_seconds: pendingCall.durationSeconds,
        outcome,
        source: "mobile-dialpad",
      });
      setPendingCall(null);
      setLinkPickerOpen(false);
    },
    [logCall, outcome, pendingCall],
  );

  const onSkip = useCallback(() => {
    void submitCallLog(matchedLeadIdRef.current).finally(() => {
      matchedLeadIdRef.current = undefined;
    });
  }, [submitCallLog]);

  const onAddNewLead = useCallback(() => {
    if (!pendingCall) return;
    const payload = { ...pendingCall, outcome };
    setPendingCall(null);
    navigation.navigate("LeadsTab", {
      screen: "LeadCreateScreen",
      params: {
        prefilledPhone: payload.phoneNumber,
        pendingCallLog: payload,
      },
    });
  }, [navigation, outcome, pendingCall]);

  const onLinkExisting = useCallback(() => {
    setLinkPickerOpen(true);
  }, []);

  const onLeadLinked = useCallback(
    (lead: LeadRow) => {
      void submitCallLog(lead.id);
    },
    [submitCallLog],
  );

  return (
    <View style={[styles.container, { paddingBottom: TAB_BAR_SCROLL_PADDING + insets.bottom }]}>
      <Text style={styles.heading}>Dial pad</Text>

      <View style={styles.displayWrap}>
        <Text style={styles.display} numberOfLines={1} adjustsFontSizeToFit>
          {displayPhone}
        </Text>
        {lookupQuery.isFetching ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.sm }} />
        ) : matchedLead ? (
          <Text style={styles.matchLine}>
            Matched: {matchedLead.leadCode} · {matchedLead.firstName} {matchedLead.lastName}
          </Text>
        ) : lookupEnabled ? (
          <Text style={styles.matchLineMuted}>
            No matching lead — you can add or link after the call
          </Text>
        ) : null}
      </View>

      <DialPadKeypad
        onPressKey={appendDigit}
        onBackspace={backspace}
        onLongPressZero={onLongPressZero}
      />

      <View style={styles.actions}>
        <Pressable
          style={[styles.callBtn, (!normalizedPhone || calling) && styles.btnDisabled]}
          onPress={() => void startCall()}
          disabled={!normalizedPhone || calling}
          accessibilityRole="button"
          accessibilityLabel="Call"
        >
          <Text style={styles.callBtnText}>{calling ? "Calling…" : "CALL"}</Text>
        </Pressable>
        <Pressable
          style={[styles.endBtn, !calling && styles.btnDisabled]}
          onPress={endCallTracking}
          disabled={!calling}
          accessibilityRole="button"
          accessibilityLabel="End call tracking"
        >
          <Text style={styles.endBtnText}>END</Text>
        </Pressable>
      </View>

      <PostCallActionModal
        visible={Boolean(pendingCall)}
        durationSeconds={pendingCall?.durationSeconds ?? 0}
        phoneNumber={pendingCall?.phoneNumber ?? ""}
        outcome={outcome}
        onOutcomeChange={setOutcome}
        onAddNewLead={onAddNewLead}
        onLinkExisting={onLinkExisting}
        onSkip={onSkip}
        busy={logCall.isPending}
      />

      <LinkLeadPickerModal
        visible={linkPickerOpen}
        onClose={() => setLinkPickerOpen(false)}
        onSelect={onLeadLinked}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  heading: { ...typography.heading, color: colors.text },
  displayWrap: {
    minHeight: 88,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.md,
    justifyContent: "center",
  },
  display: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: 1,
  },
  matchLine: { color: colors.success, marginTop: spacing.sm, fontSize: 13, fontWeight: "600" },
  matchLineMuted: { color: colors.textMuted, marginTop: spacing.sm, fontSize: 13 },
  actions: { flexDirection: "row", gap: spacing.md, justifyContent: "center" },
  callBtn: {
    flex: 1,
    backgroundColor: colors.success,
    borderRadius: radii.pill,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.border,
  },
  endBtn: {
    flex: 1,
    backgroundColor: colors.danger,
    borderRadius: radii.pill,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.border,
  },
  callBtnText: { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 1 },
  endBtnText: { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 1 },
  btnDisabled: { opacity: 0.45 },
});
