import {trpc} from '@/lib/trpc';
export function useWebsiteMedia(){return trpc.hotel.media.useQuery(undefined,{retry:false});}
