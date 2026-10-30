import { describe,it,expect,vi,afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateMedia,IMAGE_LIMIT,VIDEO_LIMIT,crc32 } from "./validation";
import { mediaDirectory,mediaKey } from "./storage";
import { pngFixture,mp4Fixture } from "./fixtures";
afterEach(()=>vi.unstubAllEnvs());
describe("independent media validation",()=>{
  it("checks real PNG checksums, pixels and MP4 container boundaries",()=>{expect(crc32(Buffer.from("123456789"))).toBe(0xcbf43926);expect(validateMedia(pngFixture(),"image/png","fixture.png").extension).toBe("png");expect(validateMedia(mp4Fixture(),"video/mp4","fixture.mp4").extension).toBe("mp4");});
  it.each(["text/html","image/svg+xml","application/javascript","application/octet-stream"])("refuses active/unsupported type %s",mime=>{expect(()=>validateMedia(pngFixture(),mime,"fixture.png")).toThrow();});
  it("rejects spoofed, truncated, trailing, mismatched and path filenames",()=>{
    for(const [bytes,mime,name]of [[Buffer.from("<html>"),"image/png","x.png"],[pngFixture().subarray(0,30),"image/png","x.png"],[Buffer.concat([pngFixture(),Buffer.from("script")]),"image/png","x.png"],[pngFixture(),"image/png","x.jpg"],[pngFixture(),"image/png","../x.png"],[mp4Fixture().subarray(0,12),"video/mp4","x.mp4"]] as const)expect(()=>validateMedia(bytes,mime,name)).toThrow();
    const corrupt=pngFixture();corrupt[corrupt.length-1]^=1;expect(()=>validateMedia(corrupt,"image/png","x.png")).toThrow(/checksum/);
  });
  it("rejects empty or oversized data before parsing and unsafe keys",()=>{expect(()=>validateMedia(Buffer.alloc(0),"image/png","x.png")).toThrow();expect(()=>validateMedia(Buffer.alloc(IMAGE_LIMIT+1),"image/png","x.png")).toThrow(/10 MiB/);expect(()=>validateMedia(Buffer.alloc(VIDEO_LIMIT+1),"video/mp4","x.mp4")).toThrow(/50 MiB/);expect(mediaKey.test("../secret.png")).toBe(false);});
  it("fails closed for missing or web-root storage configuration",async()=>{vi.stubEnv("SOUTHSIDE_MEDIA_ROOT","");await expect(mediaDirectory()).rejects.toThrow();vi.stubEnv("SOUTHSIDE_MEDIA_ROOT",path.resolve("client/public/uploads"));await expect(mediaDirectory()).rejects.toThrow();});
});
