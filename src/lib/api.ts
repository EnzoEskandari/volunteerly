import { NextResponse } from "next/server";

/**
 * Shared shapes for the route handlers under src/app/api.
 *
 * Every failure carries a `reason` written for the person reading it —
 * spec §5.4 requires that a blocked join explains itself specifically
 * ("This event is full", not "Request failed"). `code` lets the UI branch
 * without string-matching prose.
 */
export type ApiErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not-found"
  | "membership-required"
  | "already-registered"
  | "not-eligible"
  | "capacity"
  | "expired"
  | "duplicate"
  | "invalid"
  | "server-error";

export function apiError(code: ApiErrorCode, reason: string, status = 400) {
  return NextResponse.json({ ok: false, code, reason }, { status });
}

export function apiOk<T extends Record<string, unknown>>(payload: T = {} as T) {
  return NextResponse.json({ ok: true, ...payload });
}

export const unauthenticated = () =>
  apiError("unauthenticated", "You need to be signed in to do that.", 401);

export const forbidden = (reason = "You don't have permission to do that.") =>
  apiError("forbidden", reason, 403);

/** Logs the real error server-side and returns a message safe to show a user. */
export function serverError(label: string, err: unknown) {
  console.error(`[volunteerly] ${label}:`, err);
  return apiError("server-error", "Something went wrong on our end. Please try again.", 500);
}
