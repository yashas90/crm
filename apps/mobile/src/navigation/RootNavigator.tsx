import { isAuthenticated } from "@/lib/auth";
import { MainTabs } from "@/navigation/MainTabs";
import { LoginScreen } from "@/screens/LoginScreen";
import { useState } from "react";

export function RootNavigator() {
  const [authed, setAuthed] = useState(isAuthenticated());

  if (!authed) {
    return <LoginScreen onLoggedIn={() => setAuthed(true)} />;
  }

  return <MainTabs onLogout={() => setAuthed(false)} />;
}
