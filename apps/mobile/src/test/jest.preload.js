jest.mock("@react-native/js-polyfills/error-guard", () => ({}));

global.ErrorUtils = {
  setGlobalHandler: jest.fn(),
  getGlobalHandler: jest.fn(() => () => {}),
};

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: { version: "1.0.5" },
    nativeAppVersion: "1.0.5",
  },
}));

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: "granted", canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted", canAskAgain: true })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: "ExponentPushToken[test-token]" })),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  removeNotificationSubscription: jest.fn(),
}));

// locationTracking imports this at module load via auth-provider; keep Jest native-free.
jest.mock("expo-task-manager", () => ({
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn(async () => false),
  unregisterTaskAsync: jest.fn(async () => undefined),
}));
