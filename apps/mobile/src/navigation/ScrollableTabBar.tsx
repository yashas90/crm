import { colors } from "@/theme";
import { TAB_BAR_HEIGHT } from "@/theme/layout";
import {
  BottomTabBarHeightCallbackContext,
  type BottomTabBarProps,
} from "@react-navigation/bottom-tabs";
import { CommonActions } from "@react-navigation/native";
import { useCallback, useContext, useEffect, useRef } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  type TextStyle,
  View,
} from "react-native";

/**
 * Inactive labels on the dark bar. Active tabs use a filled primary chip
 * because raw primary on #1e293b is too dim to read.
 */
const TAB_INACTIVE = "#cbd5e1";
const TAB_ACTIVE = "#ffffff";
const ICON_SIZE = 26;

/**
 * Horizontal tab bar. Ten destinations do not fit in one phone-width row
 * without ellipsizing, so each item sizes to its full label and the row scrolls.
 */
export function ScrollableTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const onHeightChange = useContext(BottomTabBarHeightCallbackContext);
  const scrollRef = useRef<ScrollView>(null);
  const layouts = useRef(new Map<string, { x: number; width: number }>());
  const viewportWidth = useRef(0);
  const hasScrolled = useRef(false);
  const indexRef = useRef(state.index);
  const routesRef = useRef(state.routes);
  indexRef.current = state.index;
  routesRef.current = state.routes;

  const barHeight = TAB_BAR_HEIGHT + insets.bottom;

  const scrollToFocused = useCallback((index: number, animated: boolean) => {
    const route = routesRef.current[index];
    const layout = route ? layouts.current.get(route.key) : undefined;
    const viewport = viewportWidth.current;
    if (!layout || viewport <= 0) return;
    const x = Math.max(0, layout.x + layout.width / 2 - viewport / 2);
    scrollRef.current?.scrollTo({ x, animated: animated && hasScrolled.current });
    hasScrolled.current = true;
  }, []);

  useEffect(() => {
    scrollToFocused(state.index, true);
  }, [scrollToFocused, state.index]);

  return (
    <View
      testID="main-tab-bar"
      style={[styles.bar, { height: barHeight, paddingBottom: insets.bottom }]}
      onLayout={(event) => onHeightChange?.(event.nativeEvent.layout.height)}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        style={styles.scroll}
        contentContainerStyle={styles.row}
        onLayout={(event) => {
          viewportWidth.current = event.nativeEvent.layout.width;
          scrollToFocused(indexRef.current, false);
        }}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label = tabLabel(options.tabBarLabel, options.title, route.name);
          const color = focused ? TAB_ACTIVE : TAB_INACTIVE;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.dispatch({
                ...CommonActions.navigate(route),
                target: state.key,
              });
            }
          };

          return (
            <Pressable
              key={route.key}
              testID={options.tabBarButtonTestID}
              accessibilityRole={Platform.OS === "ios" ? "button" : "tab"}
              accessibilityState={{ selected: focused }}
              accessibilityLabel={
                options.tabBarAccessibilityLabel ??
                `${label}, tab, ${index + 1} of ${state.routes.length}`
              }
              onPress={onPress}
              onLongPress={() => {
                navigation.emit({ type: "tabLongPress", target: route.key });
              }}
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              onLayout={(event) => {
                const { x, width } = event.nativeEvent.layout;
                layouts.current.set(route.key, { x, width });
                if (index === indexRef.current) scrollToFocused(index, false);
              }}
            >
              <View style={[styles.pill, focused && styles.pillActive]}>
                <View style={styles.iconSlot}>
                  {options.tabBarIcon?.({ focused, color, size: ICON_SIZE })}
                  {options.tabBarBadge != null && options.tabBarBadge !== "" ? (
                    <TabBadge
                      value={options.tabBarBadge}
                      badgeStyle={options.tabBarBadgeStyle}
                      onPrimary={focused}
                    />
                  ) : null}
                </View>
                <Text
                  style={[styles.label, focused ? styles.labelActive : styles.labelIdle]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function tabLabel(tabBarLabel: unknown, title: string | undefined, routeName: string): string {
  if (typeof tabBarLabel === "string") return tabBarLabel;
  if (title) return title;
  return routeName;
}

function TabBadge({
  value,
  badgeStyle,
  onPrimary,
}: {
  value: string | number;
  badgeStyle?: StyleProp<TextStyle>;
  onPrimary: boolean;
}) {
  const flat = StyleSheet.flatten(badgeStyle);
  const accent = typeof flat?.backgroundColor === "string" ? flat.backgroundColor : colors.primary;
  const textColor = onPrimary ? accent : typeof flat?.color === "string" ? flat.color : "#ffffff";
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: onPrimary ? "#ffffff" : accent },
        !onPrimary && flat?.borderColor != null ? { borderColor: flat.borderColor } : null,
        !onPrimary && flat?.borderWidth != null ? { borderWidth: flat.borderWidth } : null,
        typeof flat?.minWidth === "number" ? { minWidth: flat.minWidth } : null,
      ]}
    >
      <Text style={[styles.badgeText, { color: textColor, fontSize: flat?.fontSize ?? 10 }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    backgroundColor: colors.card,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 16,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
  },
  scroll: {
    height: TAB_BAR_HEIGHT,
  },
  row: {
    alignItems: "center",
    paddingHorizontal: 6,
    minHeight: TAB_BAR_HEIGHT,
  },
  item: {
    flexShrink: 0,
    justifyContent: "center",
    minHeight: TAB_BAR_HEIGHT,
    paddingHorizontal: 2,
  },
  itemPressed: {
    opacity: 0.72,
  },
  pill: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 76,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 2,
  },
  pillActive: {
    backgroundColor: colors.primary,
  },
  iconSlot: {
    width: 32,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 13,
    lineHeight: 16,
    textAlign: "center",
    includeFontPadding: false,
  },
  labelIdle: {
    color: TAB_INACTIVE,
    fontWeight: "600",
  },
  labelActive: {
    color: TAB_ACTIVE,
    fontWeight: "700",
  },
  badge: {
    position: "absolute",
    top: -5,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.card,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 12,
    includeFontPadding: false,
  },
});
