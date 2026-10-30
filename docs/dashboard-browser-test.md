# Local administrator dashboard acceptance test

Open **http://127.0.0.1:3001/admin** in the browser where you are already signed in.
Do not run administrator setup again. Do not share cookies, tokens or passwords.

## Confirmed before testing

Read-only checks against the owned local development database confirmed:

- One enabled independent administrator; initial setup completed.
- One successful administrator login and one unrevoked administrator session
  within both its absolute and idle expiration limits.
- `/api/health` and `/api/ready` both return HTTP 200.
- Category **LOCAL SAMPLE classic room**, ID 1, category-authoritative capacity 3.
- Physical rooms **SAMPLE-1-1**, **SAMPLE-1-2**, **SAMPLE-1-3**, initially inspected.
- Active default rate **NGN 10,000.00**; one pending manual-confirmation reservation.

These checks confirm server-side session state, not possession of the session
cookie in a particular browser tab. No cookie/token was inspected or copied, and
no authenticated API request was impersonated. Your already-open dashboard is
the browser acceptance test. No application, credential, role or hotel record
was changed by these checks.

## Test sequence

The hotel-operation MySQL integration suite was rerun during this verification:
**10 tests passed** (`node .local/run-dashboard-tests.mjs`). It used only the
separate integration schema, covering inventory, concurrent bookings, holds,
pricing, assignments, housekeeping, maintenance, rollback and authorization.
It did not run administrator-setup tests or modify development records. No
application source changed, so a new typecheck/build was not needed for this
documentation and read-only session verification.

Use **Hotel operations**, select **LOCAL SAMPLE classic room**, then use the
**Action** dropdown under **Record an operation**. Tabs show current records;
the selected tab does not limit the Action dropdown. Supply a reason such as
`Local browser acceptance test` wherever requested. Use invented guest details.
Record new reservation/task/maintenance IDs so cleanup touches only this test.

| Step | Browser action | Expected result |
| --- | --- | --- |
| 1. Dashboard | Refresh `/admin`; inspect summary, catalogue and Hotel operations | No sign-in gate, permission error or service-error state; private records load |
| 2. Physical rooms | Add an inactive physical room labelled `BROWSER-TEST-01` (use a fresh suffix if it exists). Activate it, then deactivate it again | Room appears and status changes are saved; category capacity stays **3**. Do not switch capacity authority or reconcile to physical counts |
| 3. Housekeeping | Choose an unassigned sample room with no maintenance. Create a cleaning task, leaving Assigned staff ID blank. Advance **in progress → completed → inspected** | Room becomes dirty, then clean, then inspected. A direct jump from open to inspected is rejected; completing a task does not consume booking inventory |
| 4. Rates | Choose two consecutive future nights with free inventory. Set a dated rate of **12500.00** for the second night only; keep the first night's default rate | Rates shows the dated override. A two-night, one-room quote is **₦22,500**, assuming no other override is present |
| 5. Reservation | Create a manual reservation for those two nights, one room, one adult, zero children. Use a unique fictional guest name, `browser-test@example.invalid`, and a fictional telephone | A new reference appears; status is **pending manual confirmation**, total/outstanding **₦22,500**, amount paid zero. Browser does not supply the authoritative price |
| 6. Assignment | Assign an available inspected physical room to that new reservation | One active assignment appears. Category commitment stays one room; assigning a physical room does not count it twice |
| 7. Cancellation | Change the new reservation to **confirmed**, then **cancellation requested** | Its room remains reserved. Change to **cancelled** only after verifying this behavior; inventory is then released and its assignment is released |
| 8. Maintenance | Schedule maintenance on a free physical room for the same dates, after cancelling the test reservation | Maintenance shows one linked inventory block. Availability falls by one for that interval. A conflicting assignment/maintenance request is rejected |
| 9. Maintenance release | Release that maintenance job once | Inventory returns; the room becomes dirty and a cleaning task is created/reopened. A duplicate release is rejected. Complete cleaning through inspection |
| 10. Audit | Inspect **History**, **Status history**, **Assignments**, and **Maintenance** tabs | Actions show the authenticated actor/reason and the expected lifecycle records; cancelled reservations and released assignments/blocks remain as history |

For availability checks, open **http://127.0.0.1:3001/booking** in a second tab,
search the same category/dates, and refresh the search after each operation. Use
the availability immediately before each operation as the baseline: the existing
sample reservation may overlap your chosen interval. Compare changes of one room
rather than assuming all three rooms are initially free.

The server prevents future check-in: a future reservation cannot be changed to
checked in merely to test checkout. To test that lifecycle, create a separate
fictional reservation beginning on the hotel's current date, with availability
confirmed, assign an inspected room, confirm it, then check in and check out.
Checkout releases its assignment and creates/reopens cleaning. Keep this optional
test separate from future-night pricing/maintenance tests.

## Cleanup

- Cancel only reservations created for this test; retain their history.
- Release only the test maintenance jobs/holds and finish their cleaning tasks.
- Leave `BROWSER-TEST-01` inactive.
- Restore the dated rate to **10000.00** for the second test night. The current
  UI supports replacing rates rather than deleting them: an explicit dated
  10000.00 entry remains in history and preserves the prior effective price.
- Do not change category capacity authority, approved booking terms, existing
  unrelated reservations, financial records, credentials or roles.

Test writes through your dashboard affect only local fictional development data.
No payment or production interaction is part of this procedure. Record actual
pass/fail results as you go; the rows above describe expected behavior, not
browser interactions already executed by the assistant. If an operation fails,
retain its exact on-screen message and action name, without sharing secrets.
