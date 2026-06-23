"use client";

import { AccessDeniedEmptyState } from "@/components/common/access-denied-empty-state";
import {
  messageTemplateErrorMessage,
  useCreateMessageTemplate,
  useDeactivateMessageTemplate,
  useMessageTemplates,
  useUpdateMessageTemplate,
} from "@/hooks/use-message-templates";
import { useSession } from "@/hooks/use-session";
import { toast } from "@/lib/toast";
import {
  MESSAGE_TEMPLATE_CATEGORIES,
  MESSAGE_TEMPLATE_VARIABLE_KEYS,
  type MessageTemplateCategory,
  substituteMessageTemplate,
} from "@propninja/types/message-templates";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import Link from "next/link";
import { useMemo, useState } from "react";

const SAMPLE_VARS = {
  leadName: "Rahul Sharma",
  agentName: "Priya Agent",
  projectName: "Skyline Residency",
  unitNumber: "A-1204",
  priceListedRs: "8500000",
};

const CATEGORY_LABELS: Record<MessageTemplateCategory, string> = {
  greeting: "Greeting",
  project_details: "Project details",
  follow_up: "Follow up",
  site_visit: "Site visit",
  custom: "Custom",
};

export default function MessageTemplatesSettingsPage() {
  const { ready, isAdmin, isManager } = useSession();
  const canManage = isAdmin || isManager;
  const templates = useMessageTemplates({ all: true, enabled: ready && canManage });
  const createTemplate = useCreateMessageTemplate();
  const updateTemplate = useUpdateMessageTemplate();
  const deactivateTemplate = useDeactivateMessageTemplate();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<MessageTemplateCategory>("custom");
  const [content, setContent] = useState("");

  const preview = useMemo(() => substituteMessageTemplate(content, SAMPLE_VARS), [content]);

  function resetForm() {
    setEditingId(null);
    setShowForm(false);
    setName("");
    setCategory("custom");
    setContent("");
  }

  function startEdit(template: {
    id: string;
    name: string;
    category: MessageTemplateCategory;
    content: string;
  }) {
    setEditingId(template.id);
    setShowForm(true);
    setName(template.name);
    setCategory(template.category);
    setContent(template.content);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !content.trim()) return;

    const payload = {
      name: name.trim(),
      content: content.trim(),
      category,
    };

    if (editingId) {
      updateTemplate.mutate(
        { id: editingId, ...payload },
        {
          onSuccess: () => {
            toast.success("Template updated.");
            resetForm();
          },
          onError: (error) =>
            toast.error(messageTemplateErrorMessage(error, "Failed to update template.")),
        },
      );
      return;
    }

    createTemplate.mutate(payload, {
      onSuccess: () => {
        toast.success("Template created.");
        resetForm();
      },
      onError: (error) =>
        toast.error(messageTemplateErrorMessage(error, "Failed to create template.")),
    });
  }

  function handleDeactivate(id: string) {
    if (!isAdmin) {
      toast.error("Only admins can deactivate templates.");
      return;
    }
    deactivateTemplate.mutate(id, {
      onSuccess: () => toast.success("Template deactivated."),
      onError: (error) =>
        toast.error(messageTemplateErrorMessage(error, "Failed to deactivate template.")),
    });
  }

  if (!ready) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (!canManage) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/settings" className="hover:underline">
              Settings
            </Link>{" "}
            / <span className="text-foreground">Message templates</span>
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Message templates</h1>
        </div>
        <AccessDeniedEmptyState description="Only admins and managers can manage message templates." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/settings" className="hover:underline">
              Settings
            </Link>{" "}
            / <span className="text-foreground">Message templates</span>
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Message templates</h1>
          <p className="text-muted-foreground">
            Pre-filled WhatsApp messages for agents — not Meta Business API templates.
          </p>
        </div>
        {!showForm ? (
          <Button type="button" onClick={() => setShowForm(true)}>
            Add template
          </Button>
        ) : null}
      </div>

      {showForm ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {editingId ? "Edit template" : "New template"}
            </CardTitle>
            <CardDescription>
              Variables: {MESSAGE_TEMPLATE_VARIABLE_KEYS.map((key) => `{{${key}}}`).join(" ")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-6 lg:grid-cols-2" onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="template-name">Name</Label>
                  <Input
                    id="template-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-category">Category</Label>
                  <select
                    id="template-category"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={category}
                    onChange={(event) => setCategory(event.target.value as MessageTemplateCategory)}
                  >
                    {MESSAGE_TEMPLATE_CATEGORIES.map((value) => (
                      <option key={value} value={value}>
                        {CATEGORY_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-content">Content</Label>
                  <textarea
                    id="template-content"
                    className="min-h-[180px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={createTemplate.isPending || updateTemplate.isPending}
                  >
                    {editingId ? "Save changes" : "Create template"}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                </div>
              </div>
              <div className="border-2 border-black bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Live preview
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm">{preview || "—"}</p>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Templates</CardTitle>
          <CardDescription>
            Active templates appear in the WhatsApp picker on lead detail.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {templates.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading templates…</p>
          ) : templates.data?.items.length ? (
            templates.data.items.map((template) => (
              <div
                key={template.id}
                className={`rounded-xl border p-4 ${template.isActive ? "border-black" : "border-dashed opacity-60"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{template.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {CATEGORY_LABELS[template.category]}
                      {!template.isActive ? " · Inactive" : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit(template)}
                    >
                      Edit
                    </Button>
                    {isAdmin && template.isActive ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeactivate(template.id)}
                        disabled={deactivateTemplate.isPending}
                      >
                        Deactivate
                      </Button>
                    ) : null}
                  </div>
                </div>
                <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                  {template.content}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No templates yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
