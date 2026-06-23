"use client";

import { apiGet } from "@/lib/apiClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { useQuery } from "@tanstack/react-query";
import { MonitorSmartphone } from "lucide-react";

type LoginHistoryItem = {
  id: string;
  userId: string;
  ipAddress: string | null;
  device: "mobile" | "web";
  location: string | null;
  isNewDevice: boolean;
  createdAt: string;
};

export function LoginHistoryCard() {
  const history = useQuery({
    queryKey: ["login-history"],
    queryFn: () => apiGet<{ items: LoginHistoryItem[] }>("/api/auth/login-history?limit=5"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent sign-ins</CardTitle>
        <CardDescription>Last 5 logins to your account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {history.isLoading ? (
          <p className="text-muted-foreground">Loading login history...</p>
        ) : history.isError || !history.data?.items.length ? (
          <p className="text-muted-foreground">No recent sign-ins recorded.</p>
        ) : (
          <ul className="space-y-3">
            {history.data.items.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-3 rounded-lg border border-slate-200/80 bg-muted/20 p-3 dark:border-white/10"
              >
                <MonitorSmartphone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="font-medium capitalize">{item.device}</p>
                  <p className="text-muted-foreground">
                    {item.location ?? item.ipAddress ?? "Unknown location"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString()}
                    {item.isNewDevice ? " · New device" : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
