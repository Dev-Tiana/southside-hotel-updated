import {afterEach,expect,it,vi} from 'vitest';
import {getDb} from '../db';
import {hotelSettings,mediaAssets,auditLogs} from '../../drizzle/schema';
import {readMediaPlacements,saveMediaPlacement,readPublicMedia} from './placementRepository';
import {emptyPlacements} from './placements';
vi.mock('../db',()=>({getDb:vi.fn()}));
afterEach(()=>vi.resetAllMocks());
function fixture(failAudit=false){
  let value=JSON.stringify(emptyPlacements());const operations:string[]=[];
  const asset={id:1,assetKey:'00000000-0000-4000-8000-000000000001.jpg',sourceUrl:'/hotel-media/00000000-0000-4000-8000-000000000001.jpg',altText:'Technical test fixture',category:'hotel_upload',isPublished:true,permissionStatus:'approved'};
  const db:any={
    select:()=>({from:(table:any)=>{
      const rows=()=>table===hotelSettings?[{settingValue:value}]:table===mediaAssets?[asset]:[];
      const query:any={where:()=>query,for:async()=>{operations.push('lock');return rows();},then:(resolve:any,reject:any)=>Promise.resolve(rows()).then(resolve,reject)};return query;
    }}),
    insert:(table:any)=>({values:()=>{
      if(table===auditLogs){operations.push('audit');if(failAudit)throw Error('private database detail');return Promise.resolve();}
      return {onDuplicateKeyUpdate:async()=>{operations.push('upsert');}};
    }}),
    update:(table:any)=>({set:(next:any)=>({where:async()=>{expect(table).toBe(hotelSettings);operations.push('update');value=next.settingValue;}})}),
  };
  db.transaction=async(work:any)=>{const before=value;try{return await work(db);}catch(error){value=before;throw error;}};
  vi.mocked(getDb).mockResolvedValue(db);return{operations,state:()=>JSON.parse(value)};
}
it('persists only placements, with locks before update and an audit entry',async()=>{
  const memory=fixture();await saveMediaPlacement({target:'home.hero',ids:[1],expectedRevision:0,reason:'Offline fixture selection'},4);
  expect(memory.state().assignments).toEqual({'home.hero':[1]});expect(memory.operations).toEqual(['upsert','lock','lock','update','audit']);
  expect((await readPublicMedia())['home.hero'][0].alt).toBe('Technical test fixture');
  await expect(saveMediaPlacement({target:'home.hero',ids:[1],expectedRevision:0,reason:'Stale offline update'},4)).rejects.toMatchObject({code:'CONFLICT'});
});
it('rolls back when audit persistence fails and returns a sanitized failure',async()=>{
  const memory=fixture(true);await expect(saveMediaPlacement({target:'home.hero',ids:[1],expectedRevision:0,reason:'Offline fixture selection'},4)).rejects.toMatchObject({kind:'database_unavailable'});
  expect(memory.state()).toEqual(emptyPlacements());
});
it('does not disguise unavailable placement storage as an empty configuration',async()=>{
  vi.mocked(getDb).mockRejectedValue(Error('PRIVATE_CONNECTION_DETAILS'));await expect(readMediaPlacements()).rejects.toMatchObject({kind:'database_unavailable'});
});
