import { it,expect,vi,afterEach } from "vitest";
import { appRouter } from "./routers";
import { authorizeMedia } from "./media/routes";
import { authenticateStaff } from "./auth/service";
import { renderBookingNotification,notificationDelivery } from "./bookingNotifications";
import { persistentSubmission } from "../client/src/lib/bookingSubmission";
vi.mock("./auth/service",()=>({authenticateStaff:vi.fn(),loginStaff:vi.fn(),logoutStaff:vi.fn()}));
afterEach(()=>{vi.resetAllMocks();vi.unstubAllGlobals();vi.unstubAllEnvs();});
it.each([undefined,"user","staff"] as const)("denies media and notification access to %s",async role=>{
  const user=role?{id:1,role}:null;vi.mocked(authenticateStaff).mockResolvedValue(user as never);
  const caller=appRouter.createCaller({req:{},res:{},user} as any),code=role?"FORBIDDEN":"UNAUTHORIZED";
  await expect(caller.admin.media()).rejects.toMatchObject({code});await expect(caller.admin.notifications()).rejects.toMatchObject({code});await expect(caller.admin.publishMedia({id:1,rightsAcknowledged:true,reason:"Offline rights review"})).rejects.toMatchObject({code});
  await expect(authorizeMedia({} as any,true)).rejects.toMatchObject({code});
});
it("checks origin before permitting an authenticated upload",async()=>{vi.stubEnv("STAFF_AUTH_ORIGIN","https://hotel.invalid");vi.mocked(authenticateStaff).mockResolvedValue({id:7,role:"admin"} as never);await expect(authorizeMedia({headers:{origin:"https://attacker.invalid"},protocol:"https"} as any,true)).rejects.toMatchObject({code:"FORBIDDEN"});expect((await authorizeMedia({headers:{origin:"https://hotel.invalid"},protocol:"https"} as any,true)).id).toBe(7);});
it("keeps delivery disabled even when arbitrary environment flags are set",()=>{vi.stubEnv("EMAIL_ENABLED","true");vi.stubEnv("EMAIL_API_KEY","unused-offline-test");expect(notificationDelivery.enabled).toBe(false);});
it("renders the actual saved status without guaranteeing a pending stay",()=>{const row={reference:"TEST-123",status:"pending manual confirmation",total:"100.00",currency:"NGN",amountPaid:"0.00"};for(const audience of ["guest","administrator"] as const){const msg=renderBookingNotification(row,audience);expect(msg.text).toContain("pending manual confirmation");expect(msg.text).toContain("not a confirmed stay");expect(msg.subject).not.toMatch(/confirmed/i);}expect(renderBookingNotification({...row,status:"cancelled"},"guest").text).toContain("Current saved status: cancelled");});
it("persists one browser identifier for concurrent calls and reloads without storing guest details",async()=>{
  const storage=new Map<string,string>();vi.stubGlobal("localStorage",{getItem:(k:string)=>storage.get(k),setItem:(k:string,v:string)=>storage.set(k,v)});vi.stubGlobal("navigator",{locks:{request:async(_key:string,work:()=>unknown)=>work()}});
  const input={roomCategoryId:1,checkIn:"2030-01-01",checkOut:"2030-01-03",rooms:1,adults:1,children:0,name:"Fictional Browser Guest",email:"guest@example.invalid",phone:"0000000000"};
  const ids=await Promise.all(Array.from({length:5},()=>persistentSubmission(input)));expect(new Set(ids).size).toBe(1);expect(await persistentSubmission(input)).toBe(ids[0]);expect(await persistentSubmission({...input,rooms:2})).not.toBe(ids[0]);const values=JSON.stringify([...storage]);expect(values).not.toContain(input.email);expect(values).not.toContain(input.name);
});
it("fails closed when persistent storage is denied",async()=>{vi.stubGlobal("navigator",{locks:{request:async(_key:string,work:()=>unknown)=>work()}});vi.stubGlobal("localStorage",{getItem:()=>{throw Error("blocked");}});await expect(persistentSubmission({roomCategoryId:1,checkIn:"2030-01-01",checkOut:"2030-01-02",rooms:1,adults:1,children:0,name:"Offline",email:"a@example.invalid",phone:"0000000000"})).rejects.toThrow();});
