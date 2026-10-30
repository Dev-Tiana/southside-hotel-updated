import {z} from 'zod';
export const mediaSections={
  'home.hero':'Homepage hero','home.story':'Homepage story','home.poster':'Tour poster','home.video':'Hotel tour video','home.detail':'Homepage detail',
  'gallery':'Hotel gallery','accommodation.gallery':'Accommodation gallery','about':'About image',
  'facilities.arrival':'Facilities arrival','facilities.exterior':'Facilities exterior','facilities.interior':'Facilities interior',
} as const;
export const mediaTarget=z.string().refine(v=>Object.hasOwn(mediaSections,v)||/^category:[1-9]\d{0,8}$/.test(v),'Choose an existing website section or room category.');
export const placementInput=z.object({target:mediaTarget,ids:z.array(z.number().int().positive()).max(8).refine(v=>new Set(v).size===v.length,'Select each asset only once.'),expectedRevision:z.number().int().nonnegative(),reason:z.string().trim().min(5).max(500)}).strict();
export const undoPlacementInput=placementInput.omit({target:true,ids:true});
export type PublicMedia={id:number;url:string;alt:string;kind:'image'|'video'};
export function placementLimit(target:string){return target==='gallery'||target==='accommodation.gallery'||target.startsWith('category:')?8:1;}
export function permitsMedia(target:string,kind:PublicMedia['kind']){return target==='home.video'?kind==='video':target==='gallery'||target==='accommodation.gallery'?true:kind==='image';}
