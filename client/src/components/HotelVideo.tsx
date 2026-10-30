import {useEffect,useRef,useState} from 'react';
export default function HotelVideo({src,poster,alt='Hotel video'}:{src:string;poster?:string;alt?:string}){
  const video=useRef<HTMLVideoElement>(null);const[failed,setFailed]=useState(false);const[playing,setPlaying]=useState(false);
  useEffect(()=>{setFailed(false);setPlaying(false);const preference=matchMedia('(prefers-reduced-motion: reduce)');const pause=()=>{if(preference.matches)video.current?.pause();};preference.addEventListener('change',pause);return()=>preference.removeEventListener('change',pause);},[src]);
  return failed?<div className="media-unavailable" role="status">Video unavailable. Please contact the hotel for details.</div>:<div className="hotel-video"><video ref={video} src={src} poster={poster} controls playsInline preload="none" aria-label={alt} onError={()=>setFailed(true)} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)}/><button className="text-link" type="button" onClick={()=>{if(playing)video.current?.pause();else void video.current?.play().catch(()=>setPlaying(false));}}>{playing?'Pause video':'Play video'}</button></div>;
}
