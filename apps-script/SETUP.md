# Showroom sign-in — backend setup

The kiosk at [showroom.lab.withbureau.com](https://showroom.lab.withbureau.com)
is static assets on a Cloudflare Worker (`index.html` + `wrangler.toml` in the
repo root). It fires `name` / `company` / `email` at a Google Apps Script web
app, which is the code in this folder.

Apps Script rather than a Worker on purpose: `MailApp` sends as whichever Google
account owns the script, so "send from Nathan now, `londonshowroom@` later" is a
config change, not a domain-verification project. The trade-off is that the
`.gs` source is not deployed from this repo — see *Deploying* below.

## What a sign-in does

| Step | Behaviour | Fails safe? |
|---|---|---|
| Append row to the sheet | Always | No — this is the one that matters |
| Thank-you email to visitor | `SEND_VISITOR_EMAIL`, skipped for repeat visits inside `EMAIL_COOLDOWN_HOURS` | Yes |
| HubSpot contact + timeline note | `PUSH_TO_HUBSPOT`, needs `HUBSPOT_TOKEN` | Yes |
| Internal heads-up email | `NOTIFY_INTERNAL` (empty = off) | Yes |
| 15-min calendar block | `CREATE_CALENDAR_EVENT` (**off** by default) | Yes |

Everything except the sheet write runs through `attempt()` and is logged rather
than thrown. A visitor at an iPad never sees a failure because HubSpot was
having a moment.

## Files

| File | Contains |
|---|---|
| `Config.gs` | Everything you'd want to change. No secrets. |
| `Code.gs` | `doGet`/`doPost`, sheet write, repeat-visit check, calendar |
| `Email.gs` | Visitor thank-you (HTML + plain text), internal notification |
| `HubSpot.gs` | Contact search-then-create, timeline note |
| `appsscript.json` | Manifest — OAuth scopes, web app access |

## First-time setup

1. **Open the script.** It's bound to the sign-in spreadsheet: open the sheet →
   Extensions → Apps Script. The deployed web app is the `/exec` URL already in
   `index.html` line 266.

2. **Paste the files in.** Create `Config`, `Code`, `Email` and `HubSpot` script
   files and paste the matching `.gs` contents. Then View → Show manifest file
   and replace `appsscript.json`.

3. **Check the sheet tab name.** `CONFIG.SHEET_NAME` is `Sign-ins`. If the
   existing tab is called something else, either rename the tab or change the
   config. The script creates the tab with headers if it's missing, so an
   existing log with different columns is worth checking by hand first.

4. **Add the HubSpot token.** Project Settings → Script Properties → Add:

   | Property | Value | Required? |
   |---|---|---|
   | `HUBSPOT_TOKEN` | HubSpot private app token | Optional — omit to skip HubSpot |
   | `SHEET_ID` | Sign-in spreadsheet id | Only if the script is **not** bound to the sheet |

   Scopes needed on the private app: `crm.objects.contacts.read`,
   `crm.objects.contacts.write`, and notes write. Same token convention as
   `service-request` / `install-complete-form` / `delivery-details`.

   Leave the property off entirely and the HubSpot step just skips — the sheet
   and the email still work.

5. **Deploy.** Deploy → Manage deployments → edit the existing deployment →
   New version → Deploy. Keep the same deployment so the `/exec` URL in
   `index.html` doesn't change. Execute as *me*, access *anyone*.

6. **Authorise.** First run asks for Sheets, Gmail send, external requests and
   Calendar. Approve as the account that should appear as the sender.

7. **Send yourself a test.** In the editor, run `testSignIn()` from
   `Test.gs` — it pushes a fake visitor through the whole path using your own
   address. Check the sheet row, the email, and the HubSpot contact.

## Switching the sender to londonshowroom@withbureau.com

Kat's preference (and yours) was a separate showroom address rather than
routing this through sales. When it exists:

1. Create the mailbox / Google group alias.
2. On the account that owns this script: Gmail → Settings → Accounts and Import
   → *Send mail as* → Add another email address → verify it.
3. Set `CONFIG.FROM_ALIAS = 'londonshowroom@withbureau.com'`.
4. Redeploy.

`FROM_NAME` and `REPLY_TO` are separate knobs — `REPLY_TO` currently points at
Kat so visitor replies land with a human, not in a shared inbox nobody watches.

Alternative, if you'd rather the mailbox owned the automation outright: move the
script and sheet into that account's Drive and leave `FROM_ALIAS` empty. More
correct long-term, more faff now.

## The calendar question

You floated a 15-minute block per sign-in on the showroom calendar and flagged
it might "get all bunged up". Kat never gave a steer. It's written and off:
set `CREATE_CALENDAR_EVENT: true` and a `CALENDAR_ID` to try it. Easy to turn
off again if it's noise, which on a busy day it probably is.

## Deliverability

Sending from a real Google account means SPF/DKIM are already right for
`withbureau.com` — no DNS work. Worth knowing:

- `MailApp` on Workspace is capped around 1,500 recipients/day. A showroom will
  not get near that.
- The email is transactional (a courtesy note after a visit they opted into by
  signing in), so it doesn't need an unsubscribe footer. If it ever grows
  marketing content or a campaign link, that changes — it should move into
  HubSpot marketing email with proper consent tracking at that point.
- The footer offers deletion on reply, which is the minimum for a UK visitor
  register.

## Notes on the HubSpot integration

- **Search-then-create**, matching the rest of the org. No `batch/upsert`
  anywhere in Bureau's codebase, so this doesn't introduce one.
- **Existing contacts only get blanks filled.** A kiosk typo will never
  overwrite a name or company that sales has curated. Same conservatism as
  `loblaws-request-form`, which deliberately never overwrites `phone`.
- **No `lifecyclestage` write.** Nothing in the org writes it, and stamping one
  on a walk-in could drag a live opportunity backwards through the funnel.
- **No Company object write.** There are no `/crm/v3/objects/companies` writes
  anywhere in Bureau's code; the employer goes on the contact's `company`.
- **Associations use the v4 `default` endpoint**, not a hardcoded
  `associationTypeId`. The org already has a live 216-vs-228 disagreement for
  note→ticket because those get guessed; this sidesteps it.
- The visit shows up as a **timeline note**, which needs no custom property
  created first. If you later want reporting on showroom visits specifically,
  add a custom contact property (a date like `last_showroom_visit`) and patch
  it in `addVisitNote` — that's the point where Kat's "track showroom activity
  in HubSpot" becomes a filterable list rather than just timeline history.
