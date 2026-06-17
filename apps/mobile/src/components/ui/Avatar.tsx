import { CachedImage } from "@/components/ui/CachedImage";
import { colors } from "@/theme";
import { StyleSheet, Text, View } from "react-native";

const PALETTE = ["#0d9488", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#0891b2"] as const;

function colorForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

type AvatarProps = {
  name: string;
  size?: number;
  imageUri?: string | null;
  authenticatedImage?: boolean;
};

export function Avatar({ name, size = 48, imageUri, authenticatedImage = false }: AvatarProps) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2 ? `${parts[0][0] ?? ""}${parts[1][0] ?? ""}` : (parts[0]?.slice(0, 2) ?? "?");

  const radius = size / 2;

  if (imageUri) {
    return (
      <CachedImage
        uri={imageUri}
        authenticated={authenticatedImage}
        cachePolicy="memory-disk"
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: colorForName(name),
        },
      ]}
    >
      <Text style={[styles.text, { fontSize: size * 0.34 }]}>{initials.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: "#fff",
    fontWeight: "700",
  },
});
