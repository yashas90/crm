import type { NavigatorScreenParams } from "@react-navigation/native";

export type LeadsStackParamList = {
  LeadsScreen: undefined;
  LeadCreateScreen: undefined;
  LeadDetailScreen: { leadId: string };
};

export type TeamStackParamList = {
  TeamHomeScreen: undefined;
  TeamCallLogsScreen: undefined;
};

export type MainTabParamList = {
  LeadsTab: NavigatorScreenParams<LeadsStackParamList> | undefined;
  TodayTab: { focusQueue?: boolean } | undefined;
  TeamTab: NavigatorScreenParams<TeamStackParamList> | undefined;
  TasksTab: undefined;
  NotificationsTab: undefined;
  ProfileTab: undefined;
};
