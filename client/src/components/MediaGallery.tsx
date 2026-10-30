import {useEffect,useRef,useState} from 'react';
import {PhotoFrame} from './SouthsideShell';
import HotelVideo from './HotelVideo';

export type GalleryItem={url:string;alt:string;kind?:'image'|'video';source?:string};

/** Presentation only. Callers supply existing public/approved media, never private uploads. */
export default function MediaGallery({items,label='SouthSide photographs',className=''}:{items:GalleryItem[];label?:string;className?:string}){
 const [active,setActive]=useState<number|null>(null);const dialog=useRef<HTMLDialogElement>(null);
 const selected=active===null?undefined:items[active];const open=active!==null;
 useEffect(()=>{if(!open)return;const el=dialog.current;if(el&&!el.open)el.showModal();return()=>{if(el?.open)el.close();};},[open]);
 useEffect(()=>{if(active===null)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous;};},[active]);
 if(!items.length)return null;
 const move=(by:number)=>setActive(index=>index===null?null:(index+by+items.length)%items.length);
 return <section className={`southside-media-gallery ${className}`} aria-label={label}>
  <div className="media-editorial-grid">{items.map((item,index)=><button className="media-gallery-tile" key={`${item.url}:${index}`} type="button" onClick={()=>setActive(index)} aria-label={`Open ${item.kind==='video'?'video':'photograph'} ${index+1}: ${item.alt}`}>
   {item.kind==='video'?<span className="media-video-tile"><span aria-hidden="true">▷</span><span>{item.alt}</span><small>Play video</small></span>:<PhotoFrame src={item.url} alt={item.alt} label={item.alt} detail=""/>}
   <span className="media-gallery-open" aria-hidden="true">{item.kind==='video'?'Play':'View photograph'} ↗</span>
  </button>)}</div>
  <dialog ref={dialog} className="media-viewer" aria-label={label} onCancel={()=>setActive(null)} onClose={()=>setActive(null)} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();setActive(null);return;}if(event.target instanceof HTMLVideoElement)return;if(event.key==='ArrowLeft'){event.preventDefault();move(-1);}if(event.key==='ArrowRight'){event.preventDefault();move(1);}}}>
   {selected&&<><header><p aria-live="polite">{active!+1} / {items.length}</p><button type="button" autoFocus onClick={()=>setActive(null)} aria-label="Close gallery">Close ×</button></header>
    <div className="media-viewer-stage">{selected.kind==='video'?<HotelVideo key={selected.url} src={selected.url} alt={selected.alt}/>:<figure key={selected.url}><img src={selected.url} alt={selected.alt} decoding="async" onError={e=>{e.currentTarget.style.visibility='hidden';e.currentTarget.parentElement?.setAttribute('data-unavailable','true');}}/><span className="media-viewer-unavailable" role="status">Photograph unavailable</span></figure>}</div>
    <footer><button type="button" onClick={()=>move(-1)} disabled={items.length<2} aria-label="Previous photograph or video">← Previous</button><p>{selected.alt}{selected.source&&<><br/><a href={selected.source} target="_blank" rel="noreferrer">View original post ↗</a></>}</p><button type="button" onClick={()=>move(1)} disabled={items.length<2} aria-label="Next photograph or video">Next →</button></footer></>}
  </dialog>
 </section>;
}
