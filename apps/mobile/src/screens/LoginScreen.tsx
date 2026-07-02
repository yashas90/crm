import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { ApiRequestError, apiPost } from "@/lib/apiClient";
import { useAuth } from "@/providers/auth-provider";
import { colors, spacing, typography } from "@/theme";
import { neuCard } from "@/theme/neubrutal";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState(__DEV__ ? "agent1@demo.propninja" : "");
  const [password, setPassword] = useState(__DEV__ ? "admin" : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "forgot" | "forgot-sent">("login");
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      const data = await apiPost<{
        token: string;
        refreshToken: string;
        user: { id: string; email: string; name: string; role: string };
      }>("/api/auth/login", { email: email.trim(), password }, { skipTransientRetry: true });
      await login(data.token, data.user, data.refreshToken);
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === "NETWORK_ERROR") {
        setError(err.message);
      } else if (err instanceof ApiRequestError && err.code === "RATE_LIMITED") {
        setError(
          "Sign-in is temporarily locked after too many tries. Wait 2 minutes, then try once. Do not tap Sign in repeatedly.",
        );
      } else {
        setError(err instanceof Error ? err.message : "Unable to sign in");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setResetLoading(true);
    try {
      await apiPost("/api/auth/forgot-password", { email: resetEmail.trim() });
    } catch {
      // Always show success — do not reveal whether the email exists
    } finally {
      setResetLoading(false);
      setMode("forgot-sent");
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

          {mode === "login" ? (
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
              <Pressable
                onPress={() => {
                  setResetEmail(email);
                  setMode("forgot");
                }}
                style={styles.forgotLink}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>
            </View>
          ) : mode === "forgot" ? (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Reset password</Text>
              <Text style={styles.forgotDesc}>
                Enter your account email and we&apos;ll send a reset link.
              </Text>
              <TextField
                label="Email"
                value={resetEmail}
                onChangeText={setResetEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                placeholder="you@company.com"
              />
              <Button
                label="Send reset link"
                onPress={() => void handleForgotPassword()}
                loading={resetLoading}
              />
              <Pressable onPress={() => setMode("login")} style={styles.forgotLink}>
                <Text style={styles.forgotText}>Back to sign in</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.formCard}>
              <View style={styles.sentIcon}>
                <Ionicons name="mail-outline" size={32} color={colors.primary} />
              </View>
              <Text style={styles.formTitle}>Check your email</Text>
              <Text style={styles.forgotDesc}>
                If <Text style={{ fontWeight: "700" }}>{resetEmail}</Text> is registered, a reset
                link has been sent. The link expires in 1 hour.
              </Text>
              <Button
                label="Back to sign in"
                variant="secondary"
                onPress={() => setMode("login")}
              />
            </View>
          )}

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
  forgotLink: { alignItems: "center", marginTop: spacing.md, paddingVertical: spacing.xs },
  forgotText: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  forgotDesc: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  sentIcon: { alignItems: "center", marginBottom: spacing.md },
});
