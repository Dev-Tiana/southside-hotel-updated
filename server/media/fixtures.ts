// Technical one-pixel test fixture, never a replacement hotel photograph.
import { deflateSync } from "node:zlib";
import { crc32 } from "./validation";
export function pngFixture(){
  const chunk=(name:string,data:Buffer)=>{const type=Buffer.from(name),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([type,data])));return Buffer.concat([len,type,data,crc]);};
  const header=Buffer.alloc(13);header.writeUInt32BE(1,0);header.writeUInt32BE(1,4);header[8]=8;header[9]=2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk("IHDR",header),chunk("IDAT",deflateSync(Buffer.from([0,40,50,60]))),chunk("IEND",Buffer.alloc(0))]);
}
export function mp4Fixture(){const box=(name:string,data=Buffer.alloc(0))=>{const head=Buffer.alloc(8);head.writeUInt32BE(data.length+8);head.write(name,4,"ascii");return Buffer.concat([head,data]);};return Buffer.concat([box("ftyp",Buffer.from("isom\0\0\0\0isom")),box("moov"),box("mdat",Buffer.from([0]))]);}
