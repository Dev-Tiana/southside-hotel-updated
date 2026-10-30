import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { authenticateStaff } from "../auth/service";
import { assertOrigin } from "../auth/security";
import { ServiceFailure } from "../_core/diagnostics";
import { getDb } from "../db";
import { mediaAssets } from "../../drizzle/schema";
import { mediaFile, mediaKey, storeMedia } from "./storage";
import { IMAGE_LIMIT, VIDEO_LIMIT } from "./validation";

export async function authorizeMedia(req: Request, write=false) {
  const user=await authenticateStaff(req);
  if(!user)throw new TRPCError({code:"UNAUTHORIZED",message:"Staff sign-in required."});
  if(user.role!=="admin")throw new TRPCError({code:"FORBIDDEN",message:"Administrator access required."});
  if(write)assertOrigin(req);
  return user;
}
function failure(res:Response,error:unknown) {
  res.set("Cache-Control","no-store");
  if(error instanceof ServiceFailure&&error.kind==="invalid_session")return res.status(401).json({error:"Staff session expired. Please sign in again."});
  if(error instanceof TRPCError){const codes:Record<string,number>={BAD_REQUEST:400,UNAUTHORIZED:401,FORBIDDEN:403,NOT_FOUND:404,CONFLICT:409};return res.status(codes[error.code]??503).json({error:codes[error.code]?error.message:"Media service unavailable."});}
  if(error && typeof error==="object" && "type" in error && error.type==="entity.too.large")return res.status(413).json({error:"Upload exceeds the allowed file size."});
  return res.status(503).json({error:"Media service unavailable."});
}
export function registerMediaRoutes(app:Express) {
  let uploads=0;
  app.post("/api/admin/media/upload",async(req,res)=>{
    let reserved=false;
    try {
      const user=await authorizeMedia(req,true);
      const mime=req.headers["content-type"]?.split(";")[0]??"";
      if(!["image/jpeg","image/png","image/webp","video/mp4"].includes(mime))throw new TRPCError({code:"BAD_REQUEST",message:"Upload JPEG, PNG, WebP or MP4 files."});
      if(uploads>=2)return res.status(429).json({error:"Uploads are busy. Please retry shortly."});
      uploads++;reserved=true;
      await new Promise<void>((resolve,reject)=>express.raw({type:()=>true,limit:mime==="video/mp4"?VIDEO_LIMIT:IMAGE_LIMIT})(req,res,error=>error?reject(error):resolve()));
      let name:string,alt:string;
      try{name=decodeURIComponent(String(req.headers["x-media-filename"]??""));alt=decodeURIComponent(String(req.headers["x-media-alt"]??""));}catch{throw new TRPCError({code:"BAD_REQUEST",message:"Invalid file metadata."});}
      const result=await storeMedia(req.body,mime,name,alt,user.id);
      return res.status(201).json(result);
    }catch(error){return failure(res,error);}finally{if(reserved)uploads--;}
  });
  app.get("/api/admin/media/:id/preview",async(req,res)=>{
    try{await authorizeMedia(req);const id=Number(req.params.id);if(!Number.isInteger(id)||id<1)throw new TRPCError({code:"NOT_FOUND",message:"Media unavailable."});const db=await getDb();const [row]=await db.select().from(mediaAssets).where(eq(mediaAssets.id,id));if(!row)throw new TRPCError({code:"NOT_FOUND",message:"Media unavailable."});const file=await mediaFile(row);headers(res,file.mime,false);return res.sendFile(file.file,error=>{if(error&&!res.headersSent)res.status(404).end();});}catch(error){return failure(res,error);}
  });
  app.get("/hotel-media/:key",async(req,res)=>{
    try{const key=String(req.params.key);if(!mediaKey.test(key))throw new TRPCError({code:"NOT_FOUND",message:"Media unavailable."});const db=await getDb();const [row]=await db.select().from(mediaAssets).where(eq(mediaAssets.assetKey,key));if(!row?.isPublished||row.permissionStatus!=="approved")throw new TRPCError({code:"NOT_FOUND",message:"Media unavailable."});const file=await mediaFile(row);headers(res,file.mime,true);return res.sendFile(file.file,error=>{if(error&&!res.headersSent)res.status(404).end();});}catch(error){return failure(res,error);}
  });
  app.use("/hotel-media",(_req,res)=>res.status(404).json({error:"Media unavailable."}));
}
function headers(res:Response,mime:string,published:boolean) {
  res.set({"Content-Type":mime,"X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox","Cross-Origin-Resource-Policy":"same-origin","Cache-Control":published?"public, max-age=3600":"private, no-store","Content-Disposition":"inline"});
}
