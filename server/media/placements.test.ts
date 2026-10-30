import {afterEach,expect,it,vi} from 'vitest';
import {placementInput} from '../../shared/mediaPlacements';
import {changePlacements,emptyPlacements,publicPlacements,undoPlacements,type PlacementAsset} from './placements';
import {appRouter} from '../routers';
const asset=(id:number,patch:Partial<PlacementAsset>={}):PlacementAsset=>({id,assetKey:`00000000-0000-4000-8000-${String(id).padStart(12,'0')}.jpg`,sourceUrl:`/hotel-media/00000000-0000-4000-8000-${String(id).padStart(12,'0')}.jpg`,altText:'Technical fixture, not hotel content',category:'hotel_upload',isPublished:true,permissionStatus:'approved',...patch});
const input=(ids:number[],target='gallery',expectedRevision=0)=>placementInput.parse({target,ids,expectedRevision,reason:'Offline fixture placement'});
afterEach(()=>vi.unstubAllEnvs());
it('preserves ordering and cover selection while keeping asset publication unchanged',()=>{
  const assets=[asset(1),asset(2)],before=structuredClone(assets);
  const state=changePlacements(emptyPlacements(),input([2,1]),assets);
  expect(publicPlacements(state,assets).gallery.map(item=>item.id)).toEqual([2,1]);expect(assets).toEqual(before);
});
it.each([{isPublished:false},{permissionStatus:'unresolved'},{permissionStatus:'rejected'},{category:'technical_fixture'},{sourceUrl:'https://untrusted.invalid/photo.jpg'}])('rejects unsafe placement and filters public reads: %j',patch=>{
  const assets=[asset(1,patch)];expect(()=>changePlacements(emptyPlacements(),input([1]),assets)).toThrow();
  expect(publicPlacements({revision:1,history:[],assignments:{gallery:[1]}},assets)).toEqual({gallery:[]});
});
it('rejects missing assets and duplicate or unknown target input',()=>{
  expect(()=>changePlacements(emptyPlacements(),input([99]),[])).toThrow();
  expect(()=>input([1,1])).toThrow();expect(()=>input([],'__proto__')).toThrow();expect(()=>input([],'category:0')).toThrow();
});
it('rejects wrong media kinds and respects single-image slots',()=>{
  const video=asset(3);video.assetKey=video.assetKey.replace('.jpg','.mp4');video.sourceUrl=video.sourceUrl.replace('.jpg','.mp4');
  expect(()=>changePlacements(emptyPlacements(),input([3],'home.hero'),[video])).toThrow();
  expect(()=>changePlacements(emptyPlacements(),input([1],'home.video'),[asset(1)])).toThrow();
  expect(()=>changePlacements(emptyPlacements(),input([1,2],'home.hero'),[asset(1),asset(2)])).toThrow();
  expect(publicPlacements(changePlacements(emptyPlacements(),input([3],'home.video'),[video]),[video])['home.video'][0].kind).toBe('video');
});
it('reverses replacement without overwriting the original or other placements',()=>{
  const assets=[asset(1),asset(2)];const first=changePlacements(emptyPlacements(),input([1],'home.hero'),assets);
  const second=changePlacements(first,input([2],'home.hero',1),assets);
  expect(undoPlacements(second,2,assets).assignments).toEqual(first.assignments);expect(assets.map(a=>a.id)).toEqual([1,2]);
});
it('rejects stale concurrent saves and undo, and cannot resurrect revoked media',()=>{
  const first=changePlacements(emptyPlacements(),input([1]),[asset(1)]);
  expect(()=>changePlacements(first,input([1]),[asset(1)])).toThrow(/changed/);
  expect(()=>undoPlacements(first,0,[asset(1)])).toThrow(/changed/);
  const second=changePlacements(first,input([],'gallery',1),[asset(1)]);
  expect(()=>undoPlacements(second,2,[asset(1,{isPublished:false})])).toThrow(/no longer approved/);
});
it('keeps category placements isolated and bounds undo history',()=>{
  let state=emptyPlacements();for(let n=0;n<8;n++)state=changePlacements(state,input([1],'category:8',n),[asset(1)]);
  expect(state.history).toHaveLength(5);expect(Object.keys(state.assignments)).toEqual(['category:8']);
});
it.each([undefined,'user','staff'])('denies placement administration for %s before touching storage',async role=>{
  const caller=appRouter.createCaller({req:{},res:{},user:role?{id:1,role}:null} as any);const code=role?'FORBIDDEN':'UNAUTHORIZED';
  await expect(caller.admin.mediaPlacements()).rejects.toMatchObject({code});
  await expect(caller.admin.saveMediaPlacement(input([]))).rejects.toMatchObject({code});
  await expect(caller.admin.undoMediaPlacement({expectedRevision:0,reason:'Offline undo'})).rejects.toMatchObject({code});
});
