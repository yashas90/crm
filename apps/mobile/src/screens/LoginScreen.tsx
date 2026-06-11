import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { apiPost } from "@/lib/apiClient";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing, typography } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState(__DEV__ ? "agent1@demo.propninja" : "");
  const [password, setPassword] = useState(__DEV__ ? "admin" : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      const data = await apiPost<{
        token: string;
        user: { id: string; email: string; name: string; role: string };
      }>("/api/auth/login", { email: email.trim(), password });
      await login(data.token, data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={styles.brandBlock}>
            <View style={styles.logo}>
              <Ionicons name="flash" size={32} color="#fff" />
            </View>
            <Text style={styles.title}>PropNinja</Text>
            <Text style={styles.subtitle}>Real estate CRM for field agents</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Sign in</Text>
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholder="you@company.com"
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              placeholder="••••••••"
            />
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            <Button label="Sign in" onPress={() => void handleLogin()} loading={loading} />
          </View>

          {__DEV__ ? (
            <Text style={styles.hint}>Dev: agent1@demo.propninja / admin</Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundDark },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  brandBlock: { alignItems: "center", marginBottom: spacing.xl },
  logo: {
    width: 72,
    height: 72,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  title: { ...typography.heading, color: colors.textDark, fontSize: 32 },
  subtitle: { color: colors.textMutedDark, marginTop: 6, fontSize: 15 },
  formCard: {
    backgroundColor: colors.cardDark,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  formTitle: { ...typography.subheading, color: colors.textDark, marginBottom: spacing.md },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderRadius: radii.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorText: { color: "#fca5a5", flex: 1, fontSize: 14 },
  hint: { color: colors.textMutedDark, textAlign: "center", marginTop: spacing.lg, fontSize: 13 },
});
