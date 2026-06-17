import { getToken } from "@/lib/auth";
import { Image, type ImageProps } from "expo-image";
import type { ImageStyle } from "expo-image";
import type { StyleProp } from "react-native";

type CachedImageProps = Omit<ImageProps, "source"> & {
  uri: string;
  style?: StyleProp<ImageStyle>;
  /** Attach JWT for authenticated document/CDN URLs. */
  authenticated?: boolean;
};

/** Disk + memory cached remote image (avatars, document thumbnails). */
export function CachedImage({
  uri,
  style,
  authenticated = false,
  cachePolicy = "memory-disk",
  contentFit = "cover",
  ...rest
}: CachedImageProps) {
  const token = authenticated ? getToken() : null;

  return (
    <Image
      {...rest}
      source={{
        uri,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }}
      style={style}
      cachePolicy={cachePolicy}
      contentFit={contentFit}
    />
  );
}
