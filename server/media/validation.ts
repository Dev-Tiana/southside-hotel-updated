import { TRPCError } from "@trpc/server";
import { inflateSync } from "node:zlib";
export function crc32(data:Buffer){let crc=0xffffffff;for(const byte of data){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
export const IMAGE_LIMIT = 10 * 1024 * 1024;
export const VIDEO_LIMIT = 50 * 1024 * 1024;
export function invalid(message: string): never { throw new TRPCError({ code: "BAD_REQUEST", message }); }
const types = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4" } as const;
export function validateMedia(data: Buffer, suppliedType: string, filename: string) {
  if (!Object.hasOwn(types, suppliedType)) invalid("Upload JPEG, PNG, WebP photographs or MP4 videos.");
  const mime = suppliedType as keyof typeof types;
  if (!data.length || data.length > (mime.startsWith("video/") ? VIDEO_LIMIT : IMAGE_LIMIT)) invalid("Photographs must be at most 10 MiB; videos at most 50 MiB, and files must not be empty.");
  if (!filename || filename.length > 180 || /[\x00-\x1f\x7f/\\]/.test(filename)) invalid("Use a simple filename without paths or control characters.");
  const extension = filename.split(".").at(-1)?.toLowerCase();
  if (!(mime === "image/jpeg" ? ["jpg", "jpeg"] : [types[mime]]).includes(extension ?? "")) invalid("The filename extension must match the media type.");
  if (mime === "image/png") {
    if (!data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) invalid("The file is not a PNG image.");
    let pos=8, ihdr=false, idat=false, ended=false, expected=0, stride=0;
    const compressed:Buffer[]=[];
    while (pos+12<=data.length) {
      const length=data.readUInt32BE(pos), type=data.toString("ascii",pos+4,pos+8);
      if (length>data.length-pos-12) invalid("PNG data is truncated.");
      if(crc32(data.subarray(pos+4,pos+8+length))!==data.readUInt32BE(pos+8+length))invalid("PNG checksum is invalid.");
      if (!ihdr) { if (type!=="IHDR" || length!==13) invalid("PNG header is invalid."); const width=data.readUInt32BE(pos+8), height=data.readUInt32BE(pos+12); if (!width||!height||width*height>40_000_000) invalid("Image dimensions exceed 40 megapixels.");const depth=data[pos+16],colour=data[pos+17];if(depth!==8||![0,2,4,6].includes(colour)||data[pos+18]!==0||data[pos+19]!==0||data[pos+20]!==0)invalid("Use a non-interlaced 8-bit grayscale or RGB PNG.");const channels=({0:1,2:3,4:2,6:4} as Record<number,number>)[colour];stride=1+width*channels;expected=stride*height;ihdr=true; }
      if (type==="acTL") invalid("Animated PNG is not supported.");
      if (type==="IDAT") {idat=true;compressed.push(data.subarray(pos+8,pos+8+length));}
      pos+=12+length;
      if (type==="IEND") { if(length!==0) invalid("PNG end marker is invalid."); ended=true;break; }
    }
    if (!ended||!idat||pos!==data.length) invalid("PNG structure is incomplete or contains trailing data.");
    try{const decoded=inflateSync(Buffer.concat(compressed),{maxOutputLength:expected+1});if(decoded.length!==expected)invalid("PNG pixel data is incomplete.");for(let i=0;i<decoded.length;i+=stride)if(decoded[i]>4)invalid("PNG row filter is invalid.");}catch{invalid("PNG pixel data is invalid or exceeds its dimensions.");}
  } else if (mime === "image/jpeg") {
    if (data.length<20 || data[0]!==255 || data[1]!==216 || data[data.length-2]!==255 || data[data.length-1]!==217) invalid("JPEG structure is invalid or truncated.");
    let pos=2, frame=false, scan=false;
    while (pos<data.length-2) {
      if(data[pos++]!==255) invalid("JPEG marker is invalid.");
      while(data[pos]===255) pos++;
      const marker=data[pos++];
      if (marker===0xda) {scan=true;break;}
      if (pos+2>data.length) invalid("JPEG segment is truncated.");
      const size=data.readUInt16BE(pos);if(size<2||pos+size>data.length-2) invalid("JPEG segment is invalid.");
      if ([0xc0,0xc1,0xc2].includes(marker)) {if(size<8)invalid("JPEG frame is invalid.");const height=data.readUInt16BE(pos+3),width=data.readUInt16BE(pos+5);if(!width||!height||width*height>40_000_000)invalid("Image dimensions exceed 40 megapixels.");frame=true;}
      pos+=size;
    }
    if (!frame||!scan) invalid("JPEG frame or scan is missing.");
  } else if (mime === "image/webp") {
    if (data.length<25 || data.toString("ascii",0,4)!=="RIFF" || data.toString("ascii",8,12)!=="WEBP" || data.readUInt32LE(4)+8!==data.length) invalid("WebP structure is invalid or truncated.");
    let pos=12, image=false;
    while(pos+8<=data.length) {const type=data.toString("ascii",pos,pos+4),length=data.readUInt32LE(pos+4);if(length>data.length-pos-8)invalid("WebP chunk is truncated.");if(type==="ANIM"||type==="ANMF")invalid("Animated WebP is not supported.");let width=0,height=0;
      if(type==="VP8X"){if(length!==10||(data[pos+8]&2))invalid("Unsupported WebP extended header.");width=1+data.readUIntLE(pos+12,3);height=1+data.readUIntLE(pos+15,3);}
      if(type==="VP8 "){if(length<10||data.toString("hex",pos+11,pos+14)!=="9d012a")invalid("WebP frame is invalid.");width=data.readUInt16LE(pos+14)&0x3fff;height=data.readUInt16LE(pos+16)&0x3fff;image=true;}
      if(type==="VP8L"){if(length<5||data[pos+8]!==0x2f)invalid("WebP lossless frame is invalid.");const bits=data.readUInt32LE(pos+9);width=(bits&0x3fff)+1;height=((bits>>>14)&0x3fff)+1;image=true;}
      if((width||height)&&(!width||!height||width*height>40_000_000))invalid("Image dimensions exceed 40 megapixels.");pos+=8+length+(length%2);}
    if(!image||pos!==data.length)invalid("WebP image data is missing.");
  } else {
    let pos=0, ftyp=false, moov=false, mdat=false;
    while(pos+8<=data.length) {const size=data.readUInt32BE(pos), type=data.toString("ascii",pos+4,pos+8);if(size<8||size>data.length-pos)invalid("MP4 box is invalid or truncated (extended boxes are not supported).");if(pos===0){if(type!=="ftyp"||size<16)invalid("MP4 file type is missing.");const brand=data.toString("ascii",pos+8,pos+12);if(!["isom","iso2","mp41","mp42","avc1","M4V "].includes(brand))invalid("Unsupported MP4 brand.");ftyp=true;}if(type==="moov")moov=true;if(type==="mdat")mdat=true;pos+=size;}
    if(!ftyp||!moov||!mdat||pos!==data.length)invalid("MP4 metadata or media data is missing.");
  }
  return { mime, extension: types[mime], bytes: data.length };
}
