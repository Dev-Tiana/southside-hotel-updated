import {afterEach,expect,it,vi} from 'vitest';
import {recoverBooking} from '../bookingRecovery';
import {getDb} from '../db';
vi.mock('../db',()=>({getDb:vi.fn()}));
afterEach(()=>{vi.restoreAllMocks();});
function readonlyDatabase(rows:unknown[]){
  const where=vi.fn(async()=>rows),innerJoin=vi.fn(()=>({where})),from=vi.fn(()=>({innerJoin})),select=vi.fn(()=>({from}));
  vi.mocked(getDb).mockResolvedValue({select} as any);return {select,where};
}
it('existing capability recovery repeatedly returns the saved booking without a payment or booking write',async()=>{
  const row={reservationId:1,reference:'OFFLINE-RECOVERY',status:'pending manual confirmation',total:'50000.00',currency:'NGN',amountPaid:'0.00',nights:2};
  const db=readonlyDatabase([row]);const cap='321cda24-347b-4182-aa7f-d609c0d954ed';
  expect(await recoverBooking(cap)).toEqual(row);expect(await recoverBooking(cap)).toEqual(row);expect(db.select).toHaveBeenCalledTimes(2);
});
it('an unknown capability returns no booking and creates nothing',async()=>{
  readonlyDatabase([]);expect(await recoverBooking('853bec8d-8443-47d6-a8f7-a2938958c6a6')).toBeNull();
});
it('recovery reports database failure instead of inventing a booking or losing the error',async()=>{
  vi.mocked(getDb).mockRejectedValueOnce(Error('PRIVATE_DATABASE_DETAIL'));
  await expect(recoverBooking('321cda24-347b-4182-aa7f-d609c0d954ed')).rejects.toMatchObject({kind:'database_unavailable'});
});
