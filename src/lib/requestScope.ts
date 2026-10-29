// Which family profile the current request is for (set by authenticate from
// the X-Profile-Id header). null = the account holder ("Me").
import { AsyncLocalStorage } from "async_hooks";
import { Types } from "mongoose";

const store = new AsyncLocalStorage<{ profileId: Types.ObjectId | null }>();

export const runWithProfile = <T>(profileId: Types.ObjectId | null, fn: () => T) =>
  store.run({ profileId }, fn);

export const currentProfileId = (): Types.ObjectId | null => store.getStore()?.profileId ?? null;

/**
 * Query fragment limiting a list to the active profile. `profileId: null`
 * also matches documents saved before profiles existed (field missing).
 */
export const profileFilter = () => ({ profileId: currentProfileId() });
