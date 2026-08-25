import { permanentRedirect } from "next/navigation";

export default function LegacyConsentPage() {
  permanentRedirect("/soglasie-na-obrabotku");
}
