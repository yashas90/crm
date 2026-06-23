import { colors, radii, shadows, spacing } from "@/theme";
import { neuCard } from "@/theme/neubrutal";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";

type SkeletonBoxProps = {
  width?: number | `${number}%`;
  height?: number;
  style?: ViewStyle;
  borderRadius?: number;
};

export function SkeletonBox({
  width = "100%",
  height = 16,
  style,
  borderRadius = radii.sm,
}: SkeletonBoxProps) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.75, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return <Animated.View style={[styles.box, { width, height, borderRadius, opacity }, style]} />;
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.row}>
          <SkeletonBox width={48} height={48} borderRadius={24} />
          <View style={styles.rowBody}>
            <SkeletonBox height={14} width="55%" />
            <SkeletonBox height={12} width="80%" style={{ marginTop: spacing.sm }} />
            <SkeletonBox height={12} width="40%" style={{ marginTop: spacing.sm }} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: "#e5e5e5",
    borderWidth: 1,
    borderColor: colors.border,
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    ...neuCard,
  },
  rowBody: {
    flex: 1,
  },
});
