import { permanentRedirect } from "next/navigation";

export default function LegacyContactsPage() {
  permanentRedirect("/contacts");
}
