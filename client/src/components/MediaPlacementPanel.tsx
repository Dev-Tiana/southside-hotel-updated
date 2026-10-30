import {useEffect,useState} from 'react';
import {trpc} from '@/lib/trpc';
import {mediaSections,permitsMedia,placementLimit} from '@shared/mediaPlacements';
import HotelVideo from './HotelVideo';
type Asset={id:number;url:string;name:string|null;alt:string|null;isPublished:boolean;permissionStatus:string};
export default function MediaPlacementPanel({assets}:{assets:Asset[]}){
  const query=trpc.admin.mediaPlacements.useQuery(undefined,{retry:false});const categories=trpc.admin.roomDrafts.useQuery(undefined,{retry:false});const utils=trpc.useUtils();
  const[target,setTarget]=useState('home.hero'),[ids,setIds]=useState<number[]>([]),[reason,setReason]=useState(''),[message,setMessage]=useState('');
  useEffect(()=>{setIds(query.data?.assignments[target]??[]);setReason('');},[target,query.data?.revision]);
  const refreshed=()=>{void utils.admin.mediaPlacements.invalidate();void utils.hotel.media.invalidate();void utils.hotel.rooms.invalidate();};
  const save=trpc.admin.saveMediaPlacement.useMutation({onSuccess:r=>{setMessage(r.message);refreshed();},onError:e=>setMessage(e.message)});
  const undo=trpc.admin.undoMediaPlacement.useMutation({onSuccess:r=>{setMessage(r.message);refreshed();},onError:e=>setMessage(e.message)});
  const busy=save.isPending||undo.isPending;const kind=(a:Asset)=>a.url.endsWith('.mp4')?'video':'image';
  const eligible=(a:Asset)=>a.isPublished&&a.permissionStatus==='approved'&&permitsMedia(target,kind(a));
  function move(index:number,offset:number){const next=[...ids],other=index+offset;if(other<0||other>=next.length)return;[next[index],next[other]]=[next[other],next[index]];setIds(next);}
  return <section className="media-placement-panel"><h3>Website placements</h3><p>Publishing and placement are separate. Only approved published assets can be assigned. The first image is the cover. Saving affects website presentation only; it never changes room inventory or bookings.</p>
    {query.error&&<p role="alert">Placements unavailable. <button className="text-link" onClick={()=>void query.refetch()}>Retry</button></p>}
    <label>Website section<select value={target} disabled={busy} onChange={e=>setTarget(e.target.value)}>{Object.entries(mediaSections).map(([key,label])=><option key={key} value={key}>{label}</option>)}{categories.data?.map(c=><option key={c.id} value={`category:${c.id}`}>Room gallery: {c.name}</option>)}</select></label>
    <div className="media-library">{assets.map(asset=><article key={asset.id} className="media-library-card">{kind(asset)==='video'?<HotelVideo src={`/api/admin/media/${asset.id}/preview`} alt={asset.alt??'Private video preview'}/>:<img loading="lazy" src={`/api/admin/media/${asset.id}/preview`} alt={asset.alt??'Private image preview'}/>}
      <p>{asset.name} — {asset.isPublished?'Published':'Private'} ({asset.permissionStatus})</p><label><input type="checkbox" checked={ids.includes(asset.id)} disabled={busy||!eligible(asset)||(!ids.includes(asset.id)&&ids.length>=placementLimit(target))} onChange={e=>setIds(e.target.checked?[...ids,asset.id]:ids.filter(id=>id!==asset.id))}/>Select for this section</label></article>)}</div>
    {!assets.length&&<p>No uploaded media. Upload privately above; nothing is published automatically.</p>}
    <ol>{ids.map((id,index)=>{const a=assets.find(item=>item.id===id);return <li key={id}>{a?.alt??`Unavailable asset ${id}`} {index===0&&'(cover)'} <button type="button" className="text-link" disabled={busy||index===0} onClick={()=>move(index,-1)}>Move up</button> <button type="button" className="text-link" disabled={busy||index===ids.length-1} onClick={()=>move(index,1)}>Move down</button> <button type="button" className="text-link" disabled={busy||index===0} onClick={()=>setIds([id,...ids.filter(value=>value!==id)])}>Make cover</button> <button type="button" className="text-link" disabled={busy} onClick={()=>setIds(ids.filter(value=>value!==id))}>Remove</button></li>;})}</ol>
    <p>Selected media will appear in this order. Private previews above do not publish files. Undo restores the previous placement snapshot (up to five saves); it does not withdraw publication.</p>
    <form className="booking-form" onSubmit={e=>{e.preventDefault();if(query.data)save.mutate({target,ids,expectedRevision:query.data.revision,reason});}}><label>Reason<input required minLength={5} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label><button className="button button-copper" disabled={!query.data||busy}>Save placement</button><button type="button" className="text-link" disabled={!query.data?.history.length||reason.trim().length<5||busy} onClick={()=>{if(query.data)undo.mutate({expectedRevision:query.data.revision,reason});}}>Undo last placement change</button></form>{message&&<p role="status">{message}</p>}
  </section>;
}
