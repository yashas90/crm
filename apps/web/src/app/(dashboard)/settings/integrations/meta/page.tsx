import { redirect } from "next/navigation";

/** Canonical Meta Business UI lives at `/settings/meta`. */
export default function MetaIntegrationsRedirectPage() {
  redirect("/settings/meta");
}
