import { RootNavigator } from "@/navigation/RootNavigator";
import { Providers } from "@/providers";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function App() {
  return (
    <SafeAreaProvider>
      <Providers>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
        <StatusBar style="light" />
      </Providers>
    </SafeAreaProvider>
  );
}
