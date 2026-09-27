import { permanentRedirect } from "next/navigation";

export default function LegacyDrillingPage() {
  permanentRedirect("/catalog/task/drilling");
}
