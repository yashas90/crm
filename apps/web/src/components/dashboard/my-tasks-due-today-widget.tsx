"use client";

import { TaskCard } from "@/components/tasks/task-card";
import { NeuButton, NeuCard } from "@/components/ui/neubrutal";
import { useTasksDueToday } from "@/hooks/use-tasks";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { CheckSquare } from "lucide-react";
import Link from "next/link";

type MyTasksDueTodayWidgetProps = {
  variant?: "default" | "neubrutal";
};

export function MyTasksDueTodayWidget({ variant = "default" }: MyTasksDueTodayWidgetProps) {
  const { data, isLoading } = useTasksDueToday();
  const tasks = data?.items ?? [];
  const count = data?.total ?? tasks.length;

  if (variant === "neubrutal") {
    return (
      <NeuCard className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <span className="font-heading text-lg font-bold uppercase">Tasks Due Today</span>
          <CheckSquare className="h-5 w-5" />
        </div>
        {isLoading ? (
          <p className="text-sm font-medium text-neutral-600">Loading...</p>
        ) : (
          <>
            <p className="mb-4 text-5xl font-bold tracking-tighter">{count}</p>
            {tasks.length > 0 ? (
              <div className="mb-4 space-y-2">
                {tasks.slice(0, 5).map((task) => (
                  <TaskCard key={task.id} task={task} showLead compact />
                ))}
              </div>
            ) : (
              <p className="mb-4 text-sm text-neutral-600">No tasks due today.</p>
            )}
            <Link href="/tasks">
              <NeuButton className="text-sm">View all tasks</NeuButton>
            </Link>
          </>
        )}
      </NeuCard>
    );
  }

  return (
    <Card className="">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          My tasks due today
        </CardTitle>
        <CheckSquare className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <>
            <p className="text-3xl font-bold">{count}</p>
            {tasks.length > 0 ? (
              <div className="space-y-2">
                {tasks.slice(0, 5).map((task) => (
                  <TaskCard key={task.id} task={task} showLead compact />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No tasks due today.</p>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href="/tasks">View all tasks</Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
