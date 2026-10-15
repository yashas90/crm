import { colors } from "@/theme";
import { useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";
import Svg, { Polyline } from "react-native-svg";

type Point = { x: number; y: number };

function svgDataUrl(points: Point[]) {
  const path = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="140"><polyline points="${path}" fill="none" stroke="#111111" stroke-width="2"/></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export function SignaturePad({ onChange }: { onChange: (value: string) => void }) {
  const points = useRef<Point[]>([]);
  const [draw, setDraw] = useState<Point[]>([]);
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        const next = {
          x: event.nativeEvent.locationX,
          y: event.nativeEvent.locationY,
        };
        points.current = [...points.current, next];
        setDraw([...points.current]);
      },
      onPanResponderMove: (event) => {
        const next = {
          x: event.nativeEvent.locationX,
          y: event.nativeEvent.locationY,
        };
        points.current = [...points.current, next];
        setDraw([...points.current]);
        onChange(svgDataUrl(points.current));
      },
    }),
  ).current;

  return (
    <View>
      <Text style={styles.label}>Customer signature</Text>
      <View style={styles.pad} {...pan.panHandlers}>
        <Svg width="100%" height="140">
          <Polyline
            points={draw.map((point) => `${point.x},${point.y}`).join(" ")}
            fill="none"
            stroke={colors.text}
            strokeWidth={2}
          />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.text, fontWeight: "700", marginBottom: 6 },
  pad: {
    height: 140,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: "#fff",
  },
});
