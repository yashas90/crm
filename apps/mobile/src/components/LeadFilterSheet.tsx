import { useTeamMembers } from "@/hooks/use-users";
import { getUser, normalizeRole } from "@/lib/auth";
import {
  type MobileLeadFilters,
  type MobileLeadScope,
  defaultMobileLeadFilters,
} from "@/lib/leads-advanced-filters";
import { colors, radii, shadows, spacing, typography } from "@/theme";
import { LEAD_STATUSES } from "@propninja/types/enums";
import { TAG_PRESET_OPTIONS } from "@propninja/types/filters";
import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type LeadFilterSheetProps = {
  visible: boolean;
  filters: MobileLeadFilters;
  onClose: () => void;
  onApply: (filters: MobileLeadFilters) => void;
};

const SCOPE_OPTIONS: { id: MobileLeadScope; label: string; managerOnly?: boolean }[] = [
  { id: "all", label: "All" },
  { id: "my", label: "My Leads" },
  { id: "teams", label: "Teams", managerOnly: true },
  { id: "unassigned", label: "Unassigned", managerOnly: true },
];

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
  not_interested: "Not Interested",
  dropped: "Dropped",
};

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function AgentPicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; name: string }[];
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={styles.select} onPress={() => setOpen((v) => !v)}>
        <Text style={styles.selectText}>{selected?.name ?? "Any agent"}</Text>
      </Pressable>
      {open ? (
        <View style={styles.optionList}>
          <Pressable
            style={styles.optionRow}
            onPress={() => {
              onChange("");
              setOpen(false);
            }}
          >
            <Text style={styles.optionText}>Any agent</Text>
          </Pressable>
          {options.map((opt) => (
            <Pressable
              key={opt.id}
              style={styles.optionRow}
              onPress={() => {
                onChange(opt.id);
                setOpen(false);
              }}
            >
              <Text style={[styles.optionText, value === opt.id && styles.optionTextActive]}>
                {opt.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function LeadFilterSheet({ visible, filters, onClose, onApply }: LeadFilterSheetProps) {
  const { data: teamMembers } = useTeamMembers();
  const role = normalizeRole(getUser()?.role ?? "agent");
  const isManager = role === "admin" || role === "manager";
  const agents = teamMembers?.data?.items ?? [];

  const [draft, setDraft] = useState(filters);
  const [showProject, setShowProject] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [showBudget, setShowBudget] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDraft(filters);
    setShowProject(false);
    setShowLocation(false);
    setShowBudget(false);
  }, [visible, filters]);

  function patch(partial: Partial<MobileLeadFilters>) {
    setDraft((current) => ({ ...current, ...partial }));
  }

  function toggleTagPreset(id: string) {
    setDraft((current) => {
      const has = current.tagPresets.includes(id);
      return {
        ...current,
        tagPresets: has ? current.tagPresets.filter((t) => t !== id) : [...current.tagPresets, id],
      };
    });
  }

  function handleReset() {
    setDraft(defaultMobileLeadFilters());
  }

  function handleApply() {
    onApply(draft);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <SafeAreaView style={styles.sheet} edges={["bottom"]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Lead Filter</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.closeBtn}>Close</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <SectionTitle title="Assign" />
            {isManager ? (
              <>
                <AgentPicker
                  label="Assign To"
                  value={draft.filterAssignTo}
                  options={agents}
                  onChange={(id) => patch({ filterAssignTo: id })}
                />
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Include assignment history</Text>
                  <Switch
                    value={draft.assignWithHistory}
                    onValueChange={(v) => patch({ assignWithHistory: v })}
                  />
                </View>
                <AgentPicker
                  label="Assigned From"
                  value={draft.assignedFrom}
                  options={agents}
                  onChange={(id) => patch({ assignedFrom: id })}
                />
                <AgentPicker
                  label="Assignment Done By"
                  value={draft.assignedBy}
                  options={agents}
                  onChange={(id) => patch({ assignedBy: id })}
                />
                <AgentPicker
                  label="Original Owner"
                  value={draft.originalOwner}
                  options={agents}
                  onChange={(id) => patch({ originalOwner: id })}
                />
              </>
            ) : (
              <View style={styles.chipsRow}>
                {SCOPE_OPTIONS.filter((o) => !o.managerOnly).map((opt) => (
                  <Pressable
                    key={opt.id}
                    style={[styles.chip, draft.scope === opt.id && styles.chipActive]}
                    onPress={() => patch({ scope: opt.id })}
                  >
                    <Text
                      style={[styles.chipText, draft.scope === opt.id && styles.chipTextActive]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {isManager ? (
              <>
                <SectionTitle title="Filter By" />
                <View style={styles.chipsRow}>
                  {SCOPE_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.id}
                      style={[styles.chip, draft.scope === opt.id && styles.chipActive]}
                      onPress={() => patch({ scope: opt.id })}
                    >
                      <Text
                        style={[styles.chipText, draft.scope === opt.id && styles.chipTextActive]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            <SectionTitle title="Status & Source" />
            <View style={styles.chipsRow}>
              <Pressable
                style={[styles.chip, !draft.status && styles.chipActive]}
                onPress={() => patch({ status: "" })}
              >
                <Text style={[styles.chipText, !draft.status && styles.chipTextActive]}>
                  Any status
                </Text>
              </Pressable>
              {LEAD_STATUSES.slice(0, 6).map((status) => (
                <Pressable
                  key={status}
                  style={[styles.chip, draft.status === status && styles.chipActive]}
                  onPress={() => patch({ status })}
                >
                  <Text style={[styles.chipText, draft.status === status && styles.chipTextActive]}>
                    {STATUS_LABELS[status] ?? status}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextField
              label="Source"
              value={draft.source}
              onChangeText={(v) => patch({ source: v })}
              placeholder="e.g. facebook"
            />

            <SectionTitle title="Tags" />
            <View style={styles.chipsRow}>
              {TAG_PRESET_OPTIONS.map((opt) => {
                const active = draft.tagPresets.includes(opt.id);
                return (
                  <Pressable
                    key={opt.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => toggleTagPreset(opt.id)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <SectionTitle title="Meeting / Site Visit" />
            <View style={styles.chipsRow}>
              {(
                [
                  ["meetingDone", "Meeting Done"],
                  ["meetingNotDone", "Meeting Not Done"],
                  ["siteVisitDone", "Site Visit Done"],
                  ["siteVisitNotDone", "Site Visit Not Done"],
                ] as const
              ).map(([key, label]) => (
                <Pressable
                  key={key}
                  style={[styles.chip, draft[key] && styles.chipActive]}
                  onPress={() => patch({ [key]: !draft[key] })}
                >
                  <Text style={[styles.chipText, draft[key] && styles.chipTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.expandRow} onPress={() => setShowProject((v) => !v)}>
              <Text style={styles.expandLabel}>Project & Property</Text>
              <Text style={styles.expandHint}>{showProject ? "Hide" : "Show"}</Text>
            </Pressable>
            {showProject ? (
              <View style={styles.expandBlock}>
                <TextField
                  label="Project ID"
                  value={draft.filterProjectId}
                  onChangeText={(v) => patch({ filterProjectId: v })}
                  placeholder="UUID"
                />
                <TextField
                  label="Project Status"
                  value={draft.projectStatus}
                  onChangeText={(v) => patch({ projectStatus: v })}
                />
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Associated projects only</Text>
                  <Switch
                    value={draft.associatedProjectsOnly}
                    onValueChange={(v) => patch({ associatedProjectsOnly: v })}
                  />
                </View>
              </View>
            ) : null}

            <Pressable style={styles.expandRow} onPress={() => setShowLocation((v) => !v)}>
              <Text style={styles.expandLabel}>Location</Text>
              <Text style={styles.expandHint}>{showLocation ? "Hide" : "Show"}</Text>
            </Pressable>
            {showLocation ? (
              <View style={styles.expandBlock}>
                <TextField
                  label="City"
                  value={draft.filterCity}
                  onChangeText={(v) => patch({ filterCity: v })}
                />
                <TextField
                  label="State"
                  value={draft.filterState}
                  onChangeText={(v) => patch({ filterState: v })}
                />
                <TextField
                  label="Locality"
                  value={draft.locality}
                  onChangeText={(v) => patch({ locality: v })}
                />
              </View>
            ) : null}

            <Pressable style={styles.expandRow} onPress={() => setShowBudget((v) => !v)}>
              <Text style={styles.expandLabel}>Budget & Area</Text>
              <Text style={styles.expandHint}>{showBudget ? "Hide" : "Show"}</Text>
            </Pressable>
            {showBudget ? (
              <View style={styles.expandBlock}>
                <TextField
                  label="Min budget from"
                  value={draft.minBudgetFrom}
                  onChangeText={(v) => patch({ minBudgetFrom: v })}
                  keyboardType="numeric"
                />
                <TextField
                  label="Min budget to"
                  value={draft.minBudgetTo}
                  onChangeText={(v) => patch({ minBudgetTo: v })}
                  keyboardType="numeric"
                />
                <TextField
                  label="Max budget from"
                  value={draft.maxBudgetFrom}
                  onChangeText={(v) => patch({ maxBudgetFrom: v })}
                  keyboardType="numeric"
                />
                <TextField
                  label="Max budget to"
                  value={draft.maxBudgetTo}
                  onChangeText={(v) => patch({ maxBudgetTo: v })}
                  keyboardType="numeric"
                />
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={styles.footerBtnSecondary} onPress={handleReset}>
              <Text style={styles.footerBtnSecondaryText}>Reset</Text>
            </Pressable>
            <Pressable style={styles.footerBtnPrimary} onPress={handleApply}>
              <Text style={styles.footerBtnPrimaryText}>Search</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    maxHeight: "92%",
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.neu,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { ...typography.heading, fontSize: 18, color: colors.text },
  closeBtn: { color: colors.primary, fontWeight: "700", fontSize: 15 },
  scroll: { flexGrow: 0 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.lg, gap: spacing.sm },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.primary,
    textTransform: "uppercase",
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.border },
  chipText: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
  chipTextActive: { color: "#fff" },
  field: { marginBottom: spacing.sm },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: 4 },
  input: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: colors.card,
  },
  select: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    backgroundColor: colors.card,
  },
  selectText: { color: colors.text, fontSize: 14 },
  optionList: {
    marginTop: 4,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    maxHeight: 160,
  },
  optionRow: { paddingHorizontal: spacing.sm, paddingVertical: 10 },
  optionText: { color: colors.text, fontSize: 14 },
  optionTextActive: { color: colors.primary, fontWeight: "700" },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  switchLabel: { flex: 1, color: colors.text, fontSize: 14, marginRight: spacing.sm },
  expandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  expandLabel: { fontWeight: "700", color: colors.text, fontSize: 14 },
  expandHint: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  expandBlock: { gap: spacing.xs },
  footer: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerBtnSecondary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    backgroundColor: colors.card,
  },
  footerBtnSecondaryText: { fontWeight: "800", color: colors.text },
  footerBtnPrimary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    backgroundColor: colors.primary,
  },
  footerBtnPrimaryText: { fontWeight: "800", color: "#fff" },
});
