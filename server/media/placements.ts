import {z} from 'zod';
import {TRPCError} from '@trpc/server';
import {mediaTarget,placementInput,placementLimit,permitsMedia,type PublicMedia} from '../../shared/mediaPlacements';
export const placementState=z.object({revision:z.number().int().nonnegative(),assignments:z.record(mediaTarget,z.array(z.number().int().positive()).max(8)),history:z.array(z.record(mediaTarget,z.array(z.number().int().positive()).max(8))).max(5)});
export type PlacementState=z.infer<typeof placementState>;
export const emptyPlacements=():PlacementState=>({revision:0,assignments:{},history:[]});
export type PlacementAsset={id:number;assetKey:string;sourceUrl:string;altText:string|null;category:string;isPublished:boolean;permissionStatus:string};
export function publishedAsset(row:PlacementAsset):PublicMedia|undefined{
  if(row.category!=='hotel_upload'||!row.isPublished||row.permissionStatus!=='approved'||!(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.(jpg|png|webp|mp4)$/.test(row.assetKey))||row.sourceUrl!==`/hotel-media/${row.assetKey}`)return;
  return{id:row.id,url:row.sourceUrl,alt:row.altText??'Hotel media',kind:row.assetKey.endsWith('.mp4')?'video':'image'};
}
export function publicPlacements(state:PlacementState,assets:PlacementAsset[]){
  const eligible=new Map(assets.flatMap(row=>{const item=publishedAsset(row);return item?[[row.id,item] as const]:[];}));
  return Object.fromEntries(Object.entries(state.assignments).map(([target,ids])=>[target,ids.flatMap(id=>{const item=eligible.get(id);return item&&permitsMedia(target,item.kind)?[item]:[];})]));
}
export function changePlacements(state:PlacementState,input:z.infer<typeof placementInput>,assets:PlacementAsset[]):PlacementState{
  if(input.expectedRevision!==state.revision)throw new TRPCError({code:'CONFLICT',message:'Media placements changed. Reload before saving.'});
  if(input.ids.length>placementLimit(input.target))throw new TRPCError({code:'BAD_REQUEST',message:'This section accepts only one asset.'});
  const eligible=new Map(assets.map(row=>[row.id,publishedAsset(row)]));
  if(input.ids.some(id=>!eligible.get(id)||!permitsMedia(input.target,eligible.get(id)!.kind)))throw new TRPCError({code:'BAD_REQUEST',message:'Select only approved published media of the correct type.'});
  return checkedState({revision:state.revision+1,assignments:{...state.assignments,[input.target]:input.ids},history:[...state.history,state.assignments].slice(-5)});
}
export function undoPlacements(state:PlacementState,expectedRevision:number,assets:PlacementAsset[]){
  if(expectedRevision!==state.revision)throw new TRPCError({code:'CONFLICT',message:'Media placements changed. Reload before undo.'});
  const previous=state.history.at(-1);if(!previous)throw new TRPCError({code:'BAD_REQUEST',message:'No saved placement to undo.'});
  // Do not resurrect permissions that were withdrawn after an earlier save.
  const safe=publicPlacements({...state,assignments:previous},assets);
  if(Object.entries(previous).some(([target,ids])=>safe[target].length!==ids.length))throw new TRPCError({code:'BAD_REQUEST',message:'Previous media is no longer approved. Choose replacement media instead.'});
  return checkedState({revision:state.revision+1,assignments:previous,history:state.history.slice(0,-1)});
}
function checkedState(value:PlacementState){if(Object.keys(value.assignments).length>64||JSON.stringify(value).length>48000)throw new TRPCError({code:'BAD_REQUEST',message:'Placement history capacity reached. Contact support.'});return placementState.parse(value);}
