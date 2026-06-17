import { captureException } from "@/lib/sentry";
import { colors, spacing, typography } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Component } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  children: ReactNode;
  screenName?: string;
};

type State = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    captureException(error, this.props.screenName ? { screen: this.props.screenName } : undefined);
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Pressable style={styles.wrap} onPress={this.handleRetry} accessibilityRole="button">
          <Ionicons name="warning-outline" size={48} color={colors.danger} />
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>Tap to retry</Text>
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
    backgroundColor: colors.backgroundDark,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    ...typography.subheading,
    color: colors.textDark,
    textAlign: "center",
  },
  message: {
    color: colors.textMutedDark,
    fontSize: 14,
    textAlign: "center",
  },
});
