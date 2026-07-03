import type { NavigatorScreenParams } from "@react-navigation/native";

export type LeadsStackParamList = {
  LeadsScreen: undefined;
  LeadCreateScreen: undefined;
  LeadDetailScreen: { leadId: string; leadIds?: string[]; leadIndex?: number };
};

export type TeamStackParamList = {
  TeamHomeScreen: undefined;
  TeamCallLogsScreen: undefined;
};

export type ProfileStackParamList = {
  ProfileScreen: undefined;
  CallLogsScreen: { dateFilter?: string } | undefined;
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
};
