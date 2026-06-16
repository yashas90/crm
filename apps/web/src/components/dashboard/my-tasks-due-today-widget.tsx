"use client";

import { TaskCard } from "@/components/tasks/task-card";
import { useTasksDueToday } from "@/hooks/use-tasks";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { CheckSquare } from "lucide-react";
import Link from "next/link";

export function MyTasksDueTodayWidget() {
  const { data, isLoading } = useTasksDueToday();
  const tasks = data?.items ?? [];
  const count = data?.total ?? tasks.length;

  return (
    <Card className="border-border/60 shadow-sm">
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
