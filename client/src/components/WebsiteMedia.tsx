import {useWebsiteMedia} from '@/hooks/useWebsiteMedia';
import MediaGallery from './MediaGallery';
export default function WebsiteMedia({target}:{target:string}){
  const query=useWebsiteMedia();const items=query.data?.[target]??[];
  if(query.error)return <p role="status">Hotel media is temporarily unavailable.</p>;
  if(!items.length)return null;
  return <MediaGallery items={items} label="SouthSide hotel media gallery"/>;
}
