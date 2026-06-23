import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { apiPost } from "@/lib/apiClient";
import { useAuth } from "@/providers/auth-provider";
import { colors, spacing, typography } from "@/theme";
import { neuCard } from "@/theme/neubrutal";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
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
            <Image
              source={require("../../assets/logo.jpg")}
              style={styles.logo}
              contentFit="contain"
            />
            <Text style={styles.title}>
              Prop<Text style={styles.titleAccent}>Ninja</Text>
            </Text>
            <Text style={styles.subtitle}>Real estate CRM for field agents</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Sign in</Text>
            <TextField
              label="Email"
              inputTestID="login-email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholder="you@company.com"
            />
            <TextField
              label="Password"
              inputTestID="login-password"
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
            <Button
              label="Sign in"
              testID="login-submit"
              onPress={() => void handleLogin()}
              loading={loading}
            />
          </View>

          {__DEV__ ? <Text style={styles.hint}>Dev: agent1@demo.propninja / admin</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  brandBlock: { alignItems: "center", marginBottom: spacing.xl },
  logo: {
    width: 200,
    height: 72,
    marginBottom: spacing.md,
  },
  title: { ...typography.heading, color: colors.text, fontSize: 34 },
  titleAccent: { color: colors.hot },
  subtitle: { color: colors.textMuted, marginTop: 6, fontSize: 15, fontWeight: "500" },
  formCard: {
    ...neuCard,
    padding: spacing.lg,
  },
  formTitle: {
    ...typography.subheading,
    color: colors.text,
    marginBottom: spacing.md,
    fontSize: 16,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(192, 32, 32, 0.12)",
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorText: { color: colors.text, flex: 1, fontSize: 14, fontWeight: "600" },
  hint: { color: colors.textMuted, textAlign: "center", marginTop: spacing.lg, fontSize: 13 },
});
