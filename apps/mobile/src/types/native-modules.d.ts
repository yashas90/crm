declare module "jail-monkey" {
  interface JailMonkey {
    isJailBroken(): boolean;
    canMockLocation(): boolean;
    trustFall(): boolean;
    isOnExternalStorage(): boolean;
    AdbEnabled(): boolean;
    isDevelopmentSettingsMode(): Promise<boolean>;
    isDebuggedMode(): boolean;
  }
  const JailMonkey: JailMonkey;
  export default JailMonkey;
}

declare module "react-native-ssl-public-key-pinning" {
  export interface PinningOptions {
    includeSubdomains?: boolean;
    publicKeyHashes: string[];
  }
  export function initializeSslPinning(options: Record<string, PinningOptions>): Promise<void>;
  export function isSslPinningAvailable(): boolean;
  export function fetch(url: string, options?: RequestInit): Promise<Response>;
}

declare module "react-native-gifted-charts" {
  import type { ViewStyle } from "react-native";

  export interface DataPoint {
    value: number;
    label?: string;
    frontColor?: string;
    topLabelComponent?: () => React.ReactNode;
    [key: string]: unknown;
  }

  export interface BarChartProps {
    data: DataPoint[];
    barWidth?: number;
    spacing?: number;
    roundedTop?: boolean;
    roundedBottom?: boolean;
    frontColor?: string;
    gradientColor?: string;
    showGradient?: boolean;
    isAnimated?: boolean;
    animationDuration?: number;
    height?: number;
    maxValue?: number;
    noOfSections?: number;
    rulesColor?: string;
    rulesType?: string;
    xAxisColor?: string;
    yAxisColor?: string;
    yAxisTextStyle?: object;
    xAxisLabelTextStyle?: object;
    hideRules?: boolean;
    style?: ViewStyle;
    [key: string]: unknown;
  }

  export interface LineChartProps {
    data: DataPoint[];
    height?: number;
    color?: string;
    thickness?: number;
    isAnimated?: boolean;
    animationDuration?: number;
    hideDataPoints?: boolean;
    curved?: boolean;
    style?: ViewStyle;
    [key: string]: unknown;
  }

  export interface PieChartProps {
    data: Array<{ value: number; color?: string; text?: string; [key: string]: unknown }>;
    radius?: number;
    innerRadius?: number;
    donut?: boolean;
    isAnimated?: boolean;
    style?: ViewStyle;
    [key: string]: unknown;
  }

  export function BarChart(props: BarChartProps): React.ReactElement;
  export function LineChart(props: LineChartProps): React.ReactElement;
  export function PieChart(props: PieChartProps): React.ReactElement;
}
