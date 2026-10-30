import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ServiceFailure, diagnose } from "./diagnostics";
import type { TrpcContext } from "./context";
import { assertOrigin, staffCanRead } from "../auth/security";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure.use(async ({ next, ctx, type }) => {
  if (type === "mutation" && ctx.staffSession) {
    try { assertOrigin(ctx.req); }
    catch (error) { if (error instanceof ServiceFailure) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: error.message }); throw error; }
  }
  const result = await next();
  if (!result.ok && result.error.cause instanceof ServiceFailure) {
    const failure = result.error.cause;
    diagnose(failure.kind);
    throw new TRPCError({ code: failure.kind === "invalid_session" ? "UNAUTHORIZED" : "SERVICE_UNAVAILABLE", message: failure.message });
  }
  return result;
});

export function checkAuthentication(ctx: TrpcContext) {
  if (ctx.authFailure) throw new TRPCError({
    code: ctx.authFailure.kind === "invalid_session" ? "UNAUTHORIZED" : "SERVICE_UNAVAILABLE",
    message: ctx.authFailure.message,
  });
}

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  checkAuthentication(ctx);
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = publicProcedure.use(requireUser);

export const staffProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!staffCanRead(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
  return next({ ctx });
});

export const adminProcedure = protectedProcedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
