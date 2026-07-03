"use client";

import { apiDelete as apiDeleteRequest, apiGet } from "@/lib/apiClient";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { cn } from "@propninja/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, RefreshCw } from "lucide-react";

type GoogleCalendarStatus = {
  connected: boolean;
  calendarId?: string;
  updatedAt?: string;
};

function useGoogleCalendarStatus() {
  return useQuery({
    queryKey: ["google-calendar", "status"],
    queryFn: () => apiGet<GoogleCalendarStatus>("/api/google-calendar/status"),
    staleTime: 30_000,
  });
}

export function GoogleCalendarSettingsCard() {
  const queryClient = useQueryClient();
  const statusQuery = useGoogleCalendarStatus();

  const connectMutation = useMutation({
    mutationFn: async () => {
      const { url } = await apiGet<{ url: string }>("/api/google-calendar/connect");
      window.location.href = url;
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not start Google sign-in"),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => apiDeleteRequest("/api/google-calendar/disconnect"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["google-calendar"] });
      toast.success("Google Calendar disconnected");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not disconnect"),
  });

  const connected = statusQuery.data?.connected;

  return (
    <Card className="overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-sky-500 to-blue-600" />
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-sky-600" />
            Google Calendar
          </CardTitle>
          <CardDescription>
            Connect your Google account to auto-sync site visits to your calendar.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={statusQuery.isFetching}
          onClick={() => void statusQuery.refetch()}
        >
          <RefreshCw className={cn("h-4 w-4", statusQuery.isFetching && "animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {statusQuery.isLoading ? (
          <p className="text-muted-foreground">Checking connection…</p>
        ) : connected ? (
          <>
            <p className="text-emerald-600 font-medium">Connected</p>
            {statusQuery.data?.calendarId ? (
              <p>
                <span className="text-muted-foreground">Calendar:</span>{" "}
                {statusQuery.data.calendarId}
              </p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disconnectMutation.isPending}
              onClick={() => void disconnectMutation.mutate()}
            >
              Disconnect
            </Button>
          </>
        ) : (
          <>
            <p className="text-muted-foreground">
              Not connected. Site visits you schedule will sync once you connect.
            </p>
            <Button
              type="button"
              size="sm"
              disabled={connectMutation.isPending}
              onClick={() => void connectMutation.mutate()}
            >
              Connect Google Calendar
            </Button>
          </>
        )}
        <p className="text-xs text-muted-foreground pt-1">
          Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the API server.
        </p>
      </CardContent>
    </Card>
  );
}
