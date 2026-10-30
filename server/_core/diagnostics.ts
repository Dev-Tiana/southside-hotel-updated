// Only fixed categories are logged. Never attach request data or original errors.
export type FailureKind = "invalid_session" | "oauth_unavailable" | "database_unavailable" | "auth_unavailable";
export class ServiceFailure extends Error {
  readonly kind: FailureKind;
  constructor(kind: FailureKind) {
    super(kind === "invalid_session" ? "Session expired. Please sign in again." : "Service temporarily unavailable.");
    this.kind = kind;
  }
}
export function diagnose(kind: FailureKind) {
  console.warn(`[Service] ${kind}`);
}
