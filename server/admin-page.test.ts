import { afterEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Admin from "../client/src/pages/Admin";
import { Router } from "wouter";

const state = vi.hoisted(() => ({
  auth: { loading: false, isAuthenticated: false, user: null, error: null, refresh: vi.fn() } as any,
  summary: { data: undefined, isLoading: false, error: null, refetch: vi.fn() } as any,
  drafts: { data: undefined, isLoading: false, error: null, refetch: vi.fn() } as any,
  summaryQuery: vi.fn(), draftsQuery: vi.fn(),
  operations: { data: null, isLoading: false, error: null } as any,
}));
vi.mock("../client/src/_core/hooks/useAuth", () => ({ useAuth: () => state.auth }));
vi.mock("../client/src/lib/trpc", () => ({ trpc: { useUtils: () => ({}), operations: {
  snapshot: { useQuery: () => state.operations },
  history: { useQuery: () => ({ data: [], isLoading: false, error: null }) },
  execute: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
}, admin: {
  payments: { useQuery: () => ({ data: {rows:[],events:[]}, isLoading:false,error:null }) },
  verifyPayment: { useMutation: () => ({isPending:false,mutate:vi.fn()}) },
  media: { useQuery: () => ({ data: [], isLoading: false, error: null }) },
  mediaPlacements: { useQuery: () => ({ data: {revision:0,assignments:{},history:[]},isLoading:false,error:null }) },
  saveMediaPlacement: { useMutation: () => ({isPending:false,mutate:vi.fn()}) },
  undoMediaPlacement: { useMutation: () => ({isPending:false,mutate:vi.fn()}) },
  publishMedia: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
  notifications: { useQuery: () => ({ data: { rows: [] }, isLoading: false, error: null }) },
  category: { useQuery: () => ({ data: undefined, isFetching: false, error: null }) },
  createCategory: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
  saveCategory: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
  categoryInventory: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
  summary: { useQuery: (...args: unknown[]) => { state.summaryQuery(...args); return state.summary; } },
  roomDrafts: { useQuery: (...args: unknown[]) => { state.draftsQuery(...args); return state.drafts; } },
} } }));
vi.mock("../client/src/components/SouthsideShell", () => ({
  SouthsideShell: ({ children }: any) => children,
  StatusPill: ({ children }: any) => children,
}));
afterEach(() => {
  state.auth = { loading: false, isAuthenticated: false, user: null, error: null, refresh: vi.fn() };
  state.summary = { isLoading: false, error: null, refetch: vi.fn() };
  state.drafts = { isLoading: false, error: null, refetch: vi.fn() };
  state.operations = { data: null, isLoading: false, error: null };
  vi.clearAllMocks();
});
const render = () => renderToStaticMarkup(createElement(Router, { hook: () => ["/admin", () => {}] }, createElement(Admin)));

it("shows the staff login gate for anonymous visitors", () => {
  expect(render()).toContain("Staff access only");
  expect(state.summaryQuery).toHaveBeenCalledWith(undefined, { enabled: false, retry: false });
});
it("shows loading without suggesting data is empty", () => {
  state.auth.loading = true;
  expect(render()).toContain("Loading staff dashboard");
  expect(render()).not.toContain("No operational reservations");
});
it("denies ordinary users and disables private queries", () => {
  state.auth = { ...state.auth, isAuthenticated: true, user: { role: "user" } };
  expect(render()).toContain("Administrator access required");
  expect(state.draftsQuery).toHaveBeenCalledWith(undefined, { enabled: false, retry: false });
});
it("shows session expiry even while another query is loading", () => {
  state.auth = { ...state.auth, isAuthenticated: true, user: { role: "admin" } };
  state.summary.error = { data: { code: "UNAUTHORIZED" } };
  state.drafts.isLoading = true;
  const html = render();
  expect(html).toContain("Session expired");
  expect(html).toContain("Sign in to continue");
});
it("shows service failure without displaying zero counts or raw errors", () => {
  state.auth.error = { data: { code: "SERVICE_UNAVAILABLE" }, message: "private SQL host" };
  const html = render();
  expect(html).toContain("Service unavailable");
  expect(html).not.toContain("private SQL host");
  expect(html).not.toContain("No operational reservations");
});
it("retains the existing administrator dashboard and renders the operations panel", () => {
  state.auth = { ...state.auth, isAuthenticated: true, user: { role: "admin", name: "Offline staff" } };
  state.summary.data = { arrivals: 0, departures: 0, pending: 0, confirmed: 0, categories: 1, reservations: [] };
  state.drafts.data = [{ id: 1, name: "Offline category", slug: "offline", verification: "verified", sellableInventory: 2, isActive: true }];
  state.operations.data = { effectiveCapacity: 2, peakCommitments: 0, reconciliationRequired: true, reservationRevisions: {}, physicalRooms: [], roomAssignments: [], reservations: [], guests: [], reservationStatusHistory: [], roomRates: [], housekeepingTasks: [], roomMaintenance: [], inventoryBlocks: [], bookingHolds: [], reservationAmendments: [] };
  const html = render();
  expect(html).toContain("Dashboard"); expect(html).toContain("Recent reservations");
  expect(html).toContain("Room category management"); expect(html).toContain("Create category");
  expect(html).toContain('class="admin-grid"'); expect(html).toContain("Hotel operations");
  expect(html).toContain("explicit inventory review"); expect(html).toContain('class="booking-form"');
});
it("shows staff a read-only dashboard without administrator controls", () => {
  state.auth = { ...state.auth, isAuthenticated: true, user: { role: "staff", name: "Offline read-only staff" } };
  state.summary.data = { arrivals: 0, departures: 0, pending: 0, confirmed: 0, categories: 1, reservations: [] };
  const html = render();
  expect(html).toContain("Dashboard");
  expect(html).toContain("Sign out");
  expect(html).not.toContain("Hotel operations");
  expect(html).not.toContain("Room category management");
  expect(state.summaryQuery).toHaveBeenCalledWith(undefined, { enabled: true, retry: false });
});
