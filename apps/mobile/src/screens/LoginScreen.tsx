import { apiPost } from "@/lib/apiClient";
import { setAuth } from "@/lib/auth";
import { colors, radii, spacing, typography } from "@/theme";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type LoginScreenProps = {
  onLoggedIn: () => void;
};

export function LoginScreen({ onLoggedIn }: LoginScreenProps) {
  const [email, setEmail] = useState("admin@propninja.local");
  const [password, setPassword] = useState("admin");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    try {
      const data = await apiPost<{
        token: string;
        user: { id: string; email: string; name: string; role: string };
      }>("/api/auth/login", { email, password });
      await setAuth(data.token, data.user);
      onLoggedIn();
    } catch (err) {
      Alert.alert("Login failed", err instanceof Error ? err.message : "Unable to sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.container}>
        <Text style={styles.title}>PropNinja</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor={colors.textMutedDark}
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Password"
          placeholderTextColor={colors.textMutedDark}
        />

        <Pressable style={styles.button} onPress={() => void handleLogin()} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </Pressable>

        <Text style={styles.hint}>Demo: admin@propninja.local / admin</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundDark },
  container: {
    flex: 1,
    backgroundColor: colors.backgroundDark,
    justifyContent: "center",
    padding: spacing.lg,
  },
  title: { ...typography.heading, color: colors.textDark, fontSize: 28 },
  subtitle: { color: colors.textMutedDark, marginBottom: spacing.lg, marginTop: 4 },
  input: {
    backgroundColor: colors.cardDark,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
    color: colors.textDark,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  hint: { color: colors.textMutedDark, textAlign: "center", marginTop: spacing.md, fontSize: 12 },
});
