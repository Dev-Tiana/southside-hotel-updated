import { newReservationInput, hotelToday, operationInput } from "@shared/operations";
import { hotelManagement } from "./management/service";
import { isReservationDate } from "@shared/reservationDate";
import { checkAuthentication } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { categoryCreate, categorySave, categoryInventory } from "../shared/categories";
import { categories, createCategory, publicCategoryMedia, publicBookingTerms } from "./management/categories";
import { listManagedMedia, publishMedia } from "./media/storage";
import {readMediaPlacements,readPublicMedia,saveMediaPlacement} from './media/placementRepository';
import {placementInput,undoPlacementInput} from '../shared/mediaPlacements';
import { listBookingNotifications } from "./bookingNotifications";
import { recoverBooking } from "./bookingRecovery";
import {paymentsService} from "./payments/service";
import {paymentRepository} from "./payments/repository";
import {getPaystackConfig} from "./payments/paystack";
import {paymentInitializeInput,paymentReferenceInput} from "./payments/routes";
import { hotelProfile, provisionalRooms } from "@shared/hotel";
import { loginStaff, logoutStaff } from "./auth/service";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, staffProcedure, publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { createContactSubmission, createReservation, getAdminSummary, listRoomDrafts, listRoomCategories, searchAvailability } from "./db";

export const dateString = z.string().refine(isReservationDate, "Use a valid date");

export const appRouter = router({
  payment:router({
    config:publicProcedure.query(()=>getPaystackConfig()),
    status:publicProcedure.input(z.object({submissionId:z.string().uuid()})).mutation(({input})=>paymentsService.status(input.submissionId)),
    initialize:publicProcedure.input(paymentInitializeInput).mutation(({input})=>paymentsService.initialize(input.submissionId,input.requestId)),
    verify:publicProcedure.input(paymentReferenceInput).mutation(({input})=>paymentsService.verify(input.submissionId,input.reference)),
    mockResolve:publicProcedure.input(paymentReferenceInput.extend({outcome:z.enum(["success","failed","pending","abandoned"])})).mutation(({input})=>paymentsService.mockResolve(input.submissionId,input.reference,input.outcome)),
  }),
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(({ ctx }) => { checkAuthentication(ctx); return ctx.user; }),
    login: publicProcedure.input(z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(128) })).mutation(({ ctx, input }) => loginStaff(ctx.req, ctx.res, input.email, input.password)),
    logout: publicProcedure.mutation(({ ctx }) => logoutStaff(ctx.req, ctx.res)),
  }),
  hotel: router({
    media:publicProcedure.query(()=>readPublicMedia()),
    profile: publicProcedure.query(() => hotelProfile),
    rooms: publicProcedure.query(async () => {
      const rows = await listRoomCategories();
      return Promise.all(rows.map(async row => ({ ...row, images: await publicCategoryMedia(row.id) })));
    }),
  }),
  booking: router({
    recover: publicProcedure.input(z.object({submissionId:z.string().uuid()})).mutation(({input})=>recoverBooking(input.submissionId)),
    terms: publicProcedure.query(() => publicBookingTerms()),
    search: publicProcedure.input(z.object({ checkIn: dateString, checkOut: dateString, adults: z.number().int().min(1).max(12), children: z.number().int().min(0).max(12), rooms: z.number().int().min(1).max(5), roomSlug: z.string().optional() })).mutation(async ({ input }) => {
      const start = new Date(`${input.checkIn}T00:00:00Z`);
      const end = new Date(`${input.checkOut}T00:00:00Z`);
      const today = new Date(`${hotelToday()}T00:00:00Z`);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) throw new TRPCError({ code: "BAD_REQUEST", message: "Check out must be later than check in." });
      if (start < today) throw new TRPCError({ code: "BAD_REQUEST", message: "Please choose a future check in date." });
      return searchAvailability(input);
    }),
    submit: publicProcedure.input(newReservationInput.extend({ rooms: z.number().int().min(1).max(5), adults: z.number().int().min(1).max(12), children: z.number().int().min(0).max(12), subtotal: z.number().nonnegative().optional(), total: z.number().nonnegative().optional(), rateSnapshot: z.string().optional(), termsSnapshot: z.string().optional() })).mutation(async ({ input }) => createReservation(input)),
    changeRequest: publicProcedure.input(z.object({ reference: z.string().min(4).max(80), email: z.string().email(), requestType: z.enum(["Cancellation request", "Modification request"]), message: z.string().min(10).max(4000), privacyAccepted: z.literal(true) })).mutation(async ({ input }) => {
      const result = await createContactSubmission({ name: `Reservation ${input.reference}`, email: input.email, enquiryType: input.requestType, message: `Reference: ${input.reference}\n\n${input.message}` });
      return { ...result, accepted: true };
    }),
  }),
  contact: router({
    submit: publicProcedure.input(z.object({ name: z.string().min(2).max(160), email: z.string().email(), phone: z.string().max(40).optional(), enquiryType: z.string().min(2).max(80), message: z.string().min(10).max(4000), privacyAccepted: z.literal(true) })).mutation(async ({ input }) => {
      const result = await createContactSubmission(input);
      return { ...result, accepted: true };
    }),
  }),
  operations: router({
    snapshot: staffProcedure.input(z.object({ categoryId: z.number().int().positive() })).query(({ input }) => hotelManagement.snapshot(input.categoryId)),
    history: staffProcedure.input(z.object({ categoryId: z.number().int().positive() })).query(({ input }) => hotelManagement.history(input.categoryId)),
    execute: adminProcedure.input(operationInput).mutation(({ input, ctx }) => hotelManagement.execute(input, ctx.user.id)),
  }),
  admin: router({
    payments:adminProcedure.query(()=>paymentRepository.list()),
    verifyPayment:adminProcedure.input(z.object({reference:z.string().regex(/^SST-[a-f0-9]{32}$/)})).mutation(({input,ctx})=>paymentsService.adminVerify(input.reference,ctx.user.id)),
    media: adminProcedure.query(() => listManagedMedia()),
    mediaPlacements:adminProcedure.query(()=>readMediaPlacements()),
    saveMediaPlacement:adminProcedure.input(placementInput).mutation(({input,ctx})=>saveMediaPlacement(input,ctx.user.id)),
    undoMediaPlacement:adminProcedure.input(undoPlacementInput).mutation(({input,ctx})=>saveMediaPlacement(input,ctx.user.id,true)),
    publishMedia: adminProcedure.input(z.object({ id: z.number().int().positive(), rightsAcknowledged: z.literal(true), reason: z.string().trim().min(5).max(2000) })).mutation(({input,ctx})=>publishMedia(input.id,ctx.user.id,input.reason)),
    notifications: adminProcedure.query(() => listBookingNotifications()),
    category: adminProcedure.input(z.object({ categoryId: z.number().int().positive() })).query(({ input }) => categories.detail(input.categoryId)),
    createCategory: adminProcedure.input(categoryCreate).mutation(({ input, ctx }) => createCategory(input, ctx.user.id)),
    saveCategory: adminProcedure.input(categorySave).mutation(({ input, ctx }) => categories.save(input, ctx.user.id)),
    categoryInventory: adminProcedure.input(categoryInventory).mutation(({ input, ctx }) => categories.inventory(input, ctx.user.id)),
    summary: staffProcedure.query(() => getAdminSummary()),
    currentUser: protectedProcedure.query(({ ctx }) => ({ id: ctx.user.id, name: ctx.user.name, email: ctx.user.email, role: ctx.user.role })),
    roomDrafts: staffProcedure.query(() => listRoomDrafts()),
  }),
});

export type AppRouter = typeof appRouter;
