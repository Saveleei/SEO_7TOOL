import { searchCatalog } from "../../data/catalogSearch";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  if (query.trim().length < 2) return Response.json(searchCatalog(""));
  return Response.json(searchCatalog(query), { headers:{ "Cache-Control":"no-store" } });
}

