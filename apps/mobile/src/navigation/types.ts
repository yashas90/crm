import type { NavigatorScreenParams } from "@react-navigation/native";

export type PendingDialPadCallLog = {
  phoneNumber: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  outcome: "answered" | "no_answer" | "busy" | "left_voicemail";
};

export type LeadsStackParamList = {
  LeadsScreen: undefined;
  LeadCreateScreen:
    | {
        prefilledPhone?: string;
        pendingCallLog?: PendingDialPadCallLog;
      }
    | undefined;
  LeadDetailScreen: {
    leadId: string;
    leadIds?: string[];
    leadIndex?: number;
    initialTab?: "calls" | "notes" | "tasks" | "visits" | "documents";
  };
};

export type TeamStackParamList = {
  TeamHomeScreen: undefined;
  TeamCallLogsScreen: undefined;
};

export type ProfileStackParamList = {
  ProfileScreen: undefined;
  CallLogsScreen: { dateFilter?: string } | undefined;
  TrackingStatusScreen: undefined;
  UserManagementScreen: undefined;
  ProjectsScreen: undefined;
  ProjectDetailScreen: { projectId: string; projectName?: string };
  ProjectUnitScreen: { projectId: string; unitId: string; unitNumber?: string };
  BookingsScreen: undefined;
  DocumentsLibraryScreen: undefined;
  SlaScreen: undefined;
};

export type VisitsStackParamList = {
  SiteVisitsHomeScreen: undefined;
  SiteVisitsCalendarScreen: undefined;
};

export type MainTabParamList = {
  LeadsTab: NavigatorScreenParams<LeadsStackParamList> | undefined;
  TodayTab: { focusQueue?: boolean } | undefined;
  TeamTab: NavigatorScreenParams<TeamStackParamList> | undefined;
  VisitsTab: NavigatorScreenParams<VisitsStackParamList> | undefined;
  TasksTab: undefined;
  NotificationsTab: undefined;
  ProfileTab: undefined;
  PipelineTab: undefined;
  DialPadTab: undefined;
};
