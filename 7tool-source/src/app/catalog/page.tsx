import { permanentRedirect } from "next/navigation";

export default function CatalogPage() {
  permanentRedirect("/#categories");
}
