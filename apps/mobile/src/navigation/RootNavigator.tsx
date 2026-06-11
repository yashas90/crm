import { MainTabs } from "@/navigation/MainTabs";
import { useAuth } from "@/providers/auth-provider";
import { LoginScreen } from "@/screens/LoginScreen";

export function RootNavigator() {
  const { status, logout } = useAuth();

  if (status !== "authenticated") {
    return <LoginScreen />;
  }

  return <MainTabs onLogout={() => void logout()} />;
}
