"use client";

import { useBlastTemplates, useSaveBlastTemplate } from "@/hooks/use-whatsapp-blaster";
import { apiDelete } from "@/lib/apiClient";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

export default function WhatsAppTemplatesPage() {
  const templates = useBlastTemplates();
  const save = useSaveBlastTemplate();
  const qc = useQueryClient();
  const items = templates.data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button asChild>
          <Link href="/whatsapp">Create in Blaster</Link>
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No saved blast templates yet.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((tpl) => (
            <Card key={tpl.id}>
              <CardHeader className="flex flex-row items-start justify-between">
                <CardTitle className="text-base">{tpl.name}</CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void apiDelete(`/api/whatsapp/blaster/templates/${tpl.id}`).then(() =>
                      qc.invalidateQueries({ queryKey: ["whatsapp-blaster"] }),
                    )
                  }
                >
                  Delete
                </Button>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{tpl.body}</p>
                <p className="mt-2 text-xs">
                  Buttons: {tpl.buttons.map((b) => b.label).join(" · ")}
                </p>
                <Button
                  className="mt-3"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void save.mutateAsync({
                      name: `${tpl.name} copy`,
                      body: tpl.body,
                      mediaUrl: tpl.mediaUrl,
                      mediaType: tpl.mediaType,
                      buttons: tpl.buttons,
                      questionFlow: tpl.questionFlow,
                      thankYouMessage: tpl.thankYouMessage,
                    })
                  }
                >
                  Duplicate
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
