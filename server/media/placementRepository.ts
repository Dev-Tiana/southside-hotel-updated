import {eq} from 'drizzle-orm';
import {getDb} from '../db';
import {hotelSettings,mediaAssets,roomCategories,auditLogs} from '../../drizzle/schema';
import {ServiceFailure} from '../_core/diagnostics';
import {TRPCError} from '@trpc/server';
import {placementInput,undoPlacementInput} from '../../shared/mediaPlacements';
import {placementState,emptyPlacements,publicPlacements,changePlacements,undoPlacements} from './placements';
const key='website_media_placements_v1';
function parse(value:string|null|undefined){return value?placementState.parse(JSON.parse(value)):emptyPlacements();}
async function safe<T>(work:()=>Promise<T>){try{return await work();}catch(e){if(e instanceof TRPCError)throw e;throw new ServiceFailure('database_unavailable');}}
export function readMediaPlacements(){return safe(async()=>{
  const db=await getDb();const[row]=await db.select().from(hotelSettings).where(eq(hotelSettings.settingKey,key));
  return parse(row?.settingValue);
});}
export function readPublicMedia(){return safe(async()=>{const state=await readMediaPlacements();const db=await getDb();return publicPlacements(state,await db.select().from(mediaAssets));});}
export function saveMediaPlacement(raw:unknown,actorId:number,undo=false){return safe(async()=>{
  const input=undo?undoPlacementInput.parse(raw):placementInput.parse(raw);const db=await getDb();
  return db.transaction(async tx=>{
    // The unique-key upsert also serializes simultaneous first saves.
    await tx.insert(hotelSettings).values({settingKey:key,settingValue:JSON.stringify(emptyPlacements()),verification:'confirmed',updatedBy:actorId}).onDuplicateKeyUpdate({set:{settingKey:key}});
    const[row]=await tx.select().from(hotelSettings).where(eq(hotelSettings.settingKey,key)).for('update');const before=parse(row.settingValue);
    if(!undo){const target=(input as ReturnType<typeof placementInput.parse>).target;if(target.startsWith('category:')){const[category]=await tx.select({id:roomCategories.id}).from(roomCategories).where(eq(roomCategories.id,Number(target.slice(9))));if(!category)throw new TRPCError({code:'NOT_FOUND',message:'Room category unavailable.'});}}
    const assets=await tx.select().from(mediaAssets).for('update');
    const after=undo?undoPlacements(before,input.expectedRevision,assets):changePlacements(before,placementInput.parse(input),assets);
    await tx.update(hotelSettings).set({settingValue:JSON.stringify(after),verification:'confirmed',updatedBy:actorId}).where(eq(hotelSettings.settingKey,key));
    await tx.insert(auditLogs).values({actorId,actorType:'staff',action:undo?'media.placement.undo':'media.placement.save',entityType:'media_placement',entityId:key,details:JSON.stringify({reason:input.reason,before:before.assignments,after:after.assignments,revision:after.revision})});
    return{message:undo?'Previous placements restored.':'Placement saved. Media publication is unchanged.',revision:after.revision};
  });
});}
