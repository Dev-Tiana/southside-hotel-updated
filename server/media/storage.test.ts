import { it,expect,vi,afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { getDb } from "../db";
import { storeMedia } from "./storage";
import { pngFixture } from "./fixtures";
import { listBookingNotifications } from "../bookingNotifications";
import { recoverBooking } from "../bookingRecovery";
vi.mock("../db",()=>({getDb:vi.fn()}));
afterEach(()=>{vi.resetAllMocks();vi.unstubAllEnvs();});
it("removes only its own uncommitted upload if database/audit persistence fails",async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),"southside-media-test-"));
  vi.stubEnv("SOUTHSIDE_MEDIA_ROOT",directory);vi.mocked(getDb).mockResolvedValue({transaction:async()=>{throw Error("private SQL server details");}} as never);
  try{await expect(storeMedia(pngFixture(),"image/png","technical.png","Technical test fixture",1)).rejects.toMatchObject({message:"Service temporarily unavailable."});expect(await fs.readdir(directory)).toEqual([]);}finally{await fs.rmdir(directory);}
});
it("sanitizes notification database failures",async()=>{vi.mocked(getDb).mockRejectedValue(Error("secret host/password"));await expect(listBookingNotifications()).rejects.toMatchObject({message:"Service temporarily unavailable."});});
it("sanitizes recovery failures without inventing a missing booking",async()=>{vi.mocked(getDb).mockRejectedValue(Error("secret database"));await expect(recoverBooking("05a31484-759a-44ce-996b-190b92016b30")).rejects.toMatchObject({message:"Service temporarily unavailable."});});
