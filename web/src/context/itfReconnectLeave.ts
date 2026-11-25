import { createContext, useContext } from 'react';

/** Runs `proceed` now, or once the reconnect ITF has finished (TT-7911). */
export type GuardItfLeave = (proceed: () => void) => void;

/**
 * Kept apart from ItfReconnectProvider so the Upload Pending leave gate can
 * chain it without importing the provider's export/upload code.
 * Without a provider (tests, web shells) leaving is never held.
 */
export const ItfReconnectLeaveContext = createContext<GuardItfLeave>(
  (proceed) => proceed()
);

export const useItfReconnectLeave = () => useContext(ItfReconnectLeaveContext);
