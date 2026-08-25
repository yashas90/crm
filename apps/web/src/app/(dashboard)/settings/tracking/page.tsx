import { redirect } from "next/navigation";

/** Canonical tracking settings UI lives under Agent Tracking. */
export default function TrackingSettingsRedirectPage() {
  redirect("/locations/settings");
}
