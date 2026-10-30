import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { mediaAssets, auditLogs } from "../../drizzle/schema";
import { getDb } from "../db";
import { ServiceFailure } from "../_core/diagnostics";
import { validateMedia } from "./validation";

export const mediaKey = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.(jpg|png|webp|mp4)$/;
export async function mediaDirectory() {
  const configured = process.env.SOUTHSIDE_MEDIA_ROOT;
  if (!configured || !path.isAbsolute(configured)) throw new ServiceFailure("database_unavailable");
  const directory = path.resolve(configured);
  for (const publicRoot of [path.resolve("client/public"), path.resolve("dist/public")]) if (directory === publicRoot || directory.startsWith(publicRoot+path.sep)) throw new ServiceFailure("database_unavailable");
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  if ((await fs.lstat(directory)).isSymbolicLink() || path.resolve(await fs.realpath(directory)).toLowerCase() !== directory.toLowerCase()) throw new ServiceFailure("database_unavailable");
  return directory;
}
async function filePath(key: string) {
  if (!mediaKey.test(key)) throw new TRPCError({ code: "NOT_FOUND", message: "Media unavailable." });
  return path.join(await mediaDirectory(),key);
}
const sha = (data: Buffer) => createHash("sha256").update(data).digest("hex");
export async function storeMedia(data: Buffer, mime: string, filename: string, alt: string, actorId: number) {
  const validated=validateMedia(data,mime,filename);
  if (alt.trim().length<2 || alt.length>250 || /[\x00-\x1f]/.test(alt)) throw new TRPCError({ code:"BAD_REQUEST",message:"Provide an image/video description between 2 and 250 characters." });
  const key=`${randomUUID()}.${validated.extension}`, file=await filePath(key);
  let written=false;
  try {
    await fs.writeFile(file,data,{flag:"wx",mode:0o600}); written=true;
    const db=await getDb();
    const result=await db.transaction(async tx=>{
      const [row]=await tx.insert(mediaAssets).values({assetKey:key,sourceUrl:`/hotel-media/${key}`,category:"hotel_upload",altText:alt.trim(),description:filename,ownershipNote:JSON.stringify({version:1,mime:validated.mime,bytes:data.length,sha256:sha(data)}),permissionStatus:"unresolved",isPublished:false});
      const id=Number(row.insertId);
      await tx.insert(auditLogs).values({actorId,actorType:"staff",action:"media.upload",entityType:"media_asset",entityId:String(id),details:JSON.stringify({bytes:data.length,mime:validated.mime,published:false})});
      return {id,url:`/hotel-media/${key}`,message:"Upload saved privately. Review the file and rights before publishing; no website placement was changed."};
    });
    return result;
  } catch(error) {
    // This randomly generated file belongs solely to this failed upload. Never
    // remove/overwrite any pre-existing object or the original hotel assets.
    if(written) await fs.unlink(file).catch(()=>{});
    if(error instanceof TRPCError)throw error;
    throw new ServiceFailure("database_unavailable");
  }
}
export async function mediaFile(row: typeof mediaAssets.$inferSelect) {
  if(row.category!=="hotel_upload") throw new TRPCError({code:"NOT_FOUND",message:"Media unavailable."});
  const file=await filePath(row.assetKey);
  try {
    const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink())throw Error();
    const metadata=JSON.parse(row.ownershipNote??"{}");
    if(metadata.version!==1||stat.size!==metadata.bytes)throw Error();
    if(!["image/png","image/jpeg","image/webp","video/mp4"].includes(metadata.mime)||!Number.isInteger(metadata.bytes)||metadata.bytes<1||metadata.bytes>50*1024*1024)throw Error();
    const digest=createHash("sha256");for await(const chunk of createReadStream(file))digest.update(chunk);
    if(digest.digest("hex")!==metadata.sha256)throw Error();
    return {file,mime:metadata.mime as string};
  }catch {throw new TRPCError({code:"NOT_FOUND",message:"Media unavailable or failed integrity checks."});}
}
export async function publishMedia(id:number,actorId:number,reason:string) {
  if(reason.trim().length<5||reason.length>2000)throw new TRPCError({code:"BAD_REQUEST",message:"Provide the publication reason."});
  try {
    const db=await getDb();
    return await db.transaction(async tx=>{
      const [row]=await tx.select().from(mediaAssets).where(eq(mediaAssets.id,id)).for("update");
      if(!row||row.category!=="hotel_upload")throw new TRPCError({code:"NOT_FOUND",message:"Only new independent uploads can be published here."});
      if(row.isPublished) return {message:"This upload is already published. No existing media was changed."};
      await mediaFile(row);
      await tx.update(mediaAssets).set({isPublished:true,permissionStatus:"approved"}).where(eq(mediaAssets.id,id));
      await tx.insert(auditLogs).values({actorId,actorType:"staff",action:"media.publish",entityType:"media_asset",entityId:String(id),details:JSON.stringify({reason,rightsAcknowledged:true,before:{isPublished:row.isPublished,permissionStatus:row.permissionStatus},after:{isPublished:true,permissionStatus:"approved"}})});
      return {message:"New upload published. Copy its URL into an approved category; existing placements are unchanged."};
    });
  }catch(error){if(error instanceof TRPCError)throw error;throw new ServiceFailure("database_unavailable");}
}
export async function listManagedMedia() {
  try {const db=await getDb();return await db.select({id:mediaAssets.id,url:mediaAssets.sourceUrl,name:mediaAssets.description,alt:mediaAssets.altText,isPublished:mediaAssets.isPublished,permissionStatus:mediaAssets.permissionStatus}).from(mediaAssets).where(eq(mediaAssets.category,"hotel_upload")).orderBy(desc(mediaAssets.id)).limit(100);}
  catch {throw new ServiceFailure("database_unavailable");}
}
