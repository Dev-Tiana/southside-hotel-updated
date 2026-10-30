import { useState, type FormEvent } from "react";
import { trpc } from "@/lib/trpc";
import MediaPlacementPanel from './MediaPlacementPanel';

export default function MediaPanel() {
  const query=trpc.admin.media.useQuery(undefined,{retry:false});
  const [message,setMessage]=useState(""),[uploading,setUploading]=useState(false),[selected,setSelected]=useState<number>();
  const utils=trpc.useUtils();
  const publish=trpc.admin.publishMedia.useMutation({onSuccess:r=>{setMessage(r.message);void utils.admin.media.invalidate();},onError:e=>setMessage(e.message)});
  const current=query.data?.find(r=>r.id===selected);
  async function upload(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const form=event.currentTarget,data=new FormData(form),file=data.get("media");
    if(!(file instanceof File)||!file.size){setMessage("Choose a photograph or MP4 video.");return;}
    if(file.size>(file.type==="video/mp4"?50:10)*1024*1024){setMessage("Photographs must be at most 10 MiB; MP4 videos at most 50 MiB.");return;}
    setUploading(true);setMessage("");
    try{const response=await fetch("/api/admin/media/upload",{method:"POST",credentials:"same-origin",headers:{"Content-Type":file.type||"application/octet-stream","X-Media-Filename":encodeURIComponent(file.name),"X-Media-Alt":encodeURIComponent(String(data.get("alt")||""))},body:file});const result=await response.json();if(!response.ok)throw Error(result.error||"Upload failed.");setMessage(result.message);setSelected(result.id);form.reset();await utils.admin.media.invalidate();}
    catch(error){setMessage(error instanceof Error?error.message:"Upload service unavailable. Please try again.");}finally{setUploading(false);}
  }
  return <section className="admin-panel media-panel" style={{marginTop:17}}><h2>Hotel media</h2>
    <p className="admin-note">Upload only hotel-owned or licensed originals. New files are private until reviewed and explicitly published. No original URL or website placement is replaced automatically. JPEG, PNG and WebP: 10 MiB maximum. MP4: 50 MiB maximum.</p>
    <form className="booking-form" onSubmit={upload}><label><span>Photograph or video</span><input name="media" type="file" accept="image/jpeg,image/png,image/webp,video/mp4" required disabled={uploading}/></label><label><span>Accessible description</span><input name="alt" minLength={2} maxLength={250} required disabled={uploading}/></label><button className="button button-copper" disabled={uploading} type="submit">{uploading?"Uploading…":"Upload privately"}</button></form>
    {message&&<p role="status">{message}</p>}{query.error&&<p role="alert">Media records are unavailable. <button className="text-link" onClick={()=>void query.refetch()}>Try again</button></p>}{query.isLoading&&<p role="status">Loading uploads…</p>}
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>New upload</th><th>Publication</th><th>Review</th></tr></thead><tbody>{query.data?.map(row=><tr key={row.id}><td>{row.name}<br/>{row.alt}</td><td>{row.isPublished?"Published":"Private"}</td><td><button className="text-link" onClick={()=>{setSelected(row.id);setMessage("");}}>Review upload {row.id}</button></td></tr>)}</tbody></table></div>
    {current&&<div className="media-review"><h3>Review: {current.name}</h3>{current.url.endsWith(".mp4")?<video controls preload="metadata" src={`/api/admin/media/${current.id}/preview`}/>:<img src={`/api/admin/media/${current.id}/preview`} alt={current.alt??"Hotel upload"}/>}
      {current.isPublished?<p>Published URL: <code>{current.url}</code>. Copy this into an approved category image field when appropriate.</p>:<form className="booking-form" onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);publish.mutate({id:current.id,rightsAcknowledged:true,reason:String(data.get("reason")||"")});}}><label className="consent-label"><input name="rights" type="checkbox" required/><span>I reviewed this file and confirm the hotel has permission to publish it.</span></label><label><span>Publication reason</span><input name="reason" minLength={5} maxLength={2000} required/></label><button className="button button-copper" disabled={publish.isPending}>Publish this new upload</button></form>}
    </div>}
    <MediaPlacementPanel assets={query.data??[]}/>
  </section>;
}
