import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { canManager, safeManagerReturnTo, type ManagerActor, type ManagerCapability } from "./managerAccess.ts";
import { resolveManagerActor } from "./managerAccessServer.ts";

export async function getManagerPageActor(): Promise<ManagerActor | null> {
  return resolveManagerActor(new Headers(await headers()));
}

export async function requireManagerPageAccess(capability: ManagerCapability, returnTo: string): Promise<ManagerActor> {
  const actor = await getManagerPageActor();
  const safeReturnTo = safeManagerReturnTo(returnTo);
  if (!actor) redirect(`/test/access?returnTo=${encodeURIComponent(safeReturnTo)}`);
  if (!canManager(actor, capability)) redirect(`/test/access?denied=1&returnTo=${encodeURIComponent(safeReturnTo)}`);
  return actor;
}
