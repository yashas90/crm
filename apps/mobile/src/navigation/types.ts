import type { NavigatorScreenParams } from "@react-navigation/native";

export type LeadsStackParamList = {
  LeadsScreen: undefined;
  LeadCreateScreen: undefined;
  LeadDetailScreen: { leadId: string };
};

export type MainTabParamList = {
  HomeTab: undefined;
  LeadsTab: NavigatorScreenParams<LeadsStackParamList> | undefined;
  TodayTab: { focusQueue?: boolean } | undefined;
  ProfileTab: undefined;
};
