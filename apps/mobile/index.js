import { registerRootComponent } from "expo";
import App from "./App";
import { initSentry } from "./src/lib/sentry";

initSentry();
registerRootComponent(App);
