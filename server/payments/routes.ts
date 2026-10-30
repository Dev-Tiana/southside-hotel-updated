import express,{type Express,type Response} from "express";
import {z} from "zod";
import {TRPCError} from "@trpc/server";
import {paymentsService} from "./service";
import {getPaystackConfig,verifyPaystackWebhook} from "./paystack";
export const paymentInitializeInput=z.object({submissionId:z.string().uuid(),requestId:z.string().uuid()}).strict();
export const paymentReferenceInput=z.object({submissionId:z.string().uuid(),reference:z.string().regex(/^SST-[a-f0-9]{32}$/)}).strict();
function error(res:Response,e:unknown){res.set("Cache-Control","no-store");if(e instanceof z.ZodError)return res.status(400).json({error:"Invalid payment request. Use the saved booking access and payment reference; amounts cannot be supplied by the browser."});if(e instanceof TRPCError){const status=({BAD_REQUEST:400,NOT_FOUND:404,CONFLICT:409,PRECONDITION_FAILED:412,FORBIDDEN:403} as Record<string,number>)[e.code]??503;return res.status(status).json({error:e.message});}return res.status(503).json({error:"Payment service unavailable. No payment result has been assumed."});}
export function registerPaymentWebhook(app:Express){
  app.post("/api/paystack/webhook",express.raw({type:"application/json",limit:"128kb"}),async(req,res)=>{
    if(process.env.SOUTHSIDE_PAYSTACK_WEBHOOKS==="disabled")return res.status(404).json({error:"Webhook delivery is disabled for this local test stage."});
    const raw=Buffer.isBuffer(req.body)?req.body:Buffer.alloc(0);
    if(!verifyPaystackWebhook(raw,req.header("x-paystack-signature")))return res.status(401).json({error:"Invalid webhook signature"});
    try{const event=JSON.parse(raw.toString("utf8"));if(event.event!=="charge.success")return res.status(200).json({ignored:true});if(event.data?.domain!=="test"||!/^SST-[a-f0-9]{32}$/.test(event.data?.reference??""))return res.status(400).json({error:"Only registered test payment references are accepted."});return res.json(await paymentsService.webhook(event.data.reference));}catch(e){return error(res,e);}
  });
}
export function registerPaymentRoutes(app:Express){
  app.post("/api/paystack/initialize",async(req,res)=>{res.set("Cache-Control","no-store");if(!getPaystackConfig().enabled)return res.status(503).json({error:"Test payment processing is disabled"});try{const input=paymentInitializeInput.parse(req.body);return res.json(await paymentsService.initialize(input.submissionId,input.requestId));}catch(e){return error(res,e);}});
  app.post("/api/paystack/verify",async(req,res)=>{res.set("Cache-Control","no-store");try{const input=paymentReferenceInput.parse(req.body);return res.json(await paymentsService.verify(input.submissionId,input.reference));}catch(e){return error(res,e);}});
}
