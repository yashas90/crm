"use client";

import { Badge } from "@/components/ui/badge";
import type { ProjectSummary } from "@/hooks/use-reports";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { Building2 } from "lucide-react";

export function ProjectsGrid({ projects }: { projects: ProjectSummary[] }) {
  if (projects.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/80 bg-muted/10 px-6 py-10 text-center">
        <Building2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          You haven&apos;t tagged leads to projects yet. Add a &apos;Project&apos; field to your
          leads to see project performance here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
        <Card
          key={project.name}
          className="border-black bg-gradient-to-br from-slate-900/[0.02] to-emerald-500/[0.06] shadow-[2px_2px_0_0_#000] transition-shadow hover:shadow-md dark:from-slate-900/40 dark:to-emerald-500/10"
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{project.name}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-2xl font-bold">{project.leadsCount}</p>
              <p className="text-xs text-muted-foreground">Leads</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {project.hotLeadsCount}
              </p>
              <p className="text-xs text-muted-foreground">
                Hot{" "}
                {project.hotLeadsCount > 0 ? (
                  <Badge className="ml-1 bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300">
                    !
                  </Badge>
                ) : null}
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {project.wonCount}
              </p>
              <p className="text-xs text-muted-foreground">Won</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
