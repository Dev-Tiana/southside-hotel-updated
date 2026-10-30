import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { ServiceFailure, diagnose } from "./diagnostics";
import { authenticateStaff } from "../auth/service";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: (Omit<User, "role"> & { role: "user" | "staff" | "admin" }) | null;
  staffSession?: boolean;
  authFailure?: ServiceFailure;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: TrpcContext["user"] = null;
  let authFailure: ServiceFailure | undefined;

  try {
    user = await authenticateStaff(opts.req);
  } catch (error) {
    authFailure = error instanceof ServiceFailure ? error : new ServiceFailure("auth_unavailable");
    diagnose(authFailure.kind);
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    staffSession: Boolean(user),
    authFailure,
  };
}
