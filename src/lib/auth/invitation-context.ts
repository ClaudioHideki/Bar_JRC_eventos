import { AsyncLocalStorage } from "node:async_hooks";

type InvitationContext = { invitationId: string; email: string; phoneE164: string };
const storage = new AsyncLocalStorage<InvitationContext>();

export function withInvitationContext<T>(context: InvitationContext, callback: () => Promise<T>): Promise<T> {
  return storage.run(context, callback);
}

export function getInvitationContext() {
  return storage.getStore();
}
