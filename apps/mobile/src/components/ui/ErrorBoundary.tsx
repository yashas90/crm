import { colors, spacing, typography } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  children: ReactNode;
  screenName?: string;
};

type State = {
  hasError: boolean;
  message: string | null;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: null };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message?.trim() ? error.message : "Unexpected error",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      this.props.screenName ? `[${this.props.screenName}]` : "[ErrorBoundary]",
      error,
      info.componentStack,
    );
  }

  private handleRetry = () => {
    this.setState({ hasError: false, message: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Pressable style={styles.wrap} onPress={this.handleRetry} accessibilityRole="button">
          <Ionicons name="warning-outline" size={48} color={colors.danger} />
          <Text style={styles.title}>Something went wrong</Text>
          {this.state.message ? <Text style={styles.message}>{this.state.message}</Text> : null}
          <Text style={styles.hint}>Tap to retry</Text>
        </Pressable>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    ...typography.subheading,
    color: colors.text,
    textAlign: "center",
  },
  message: {
    color: colors.danger,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
  },
});
