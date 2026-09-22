# Showroom sign-in - backend setup

The kiosk at [showroom.lab.withbureau.com](https://showroom.lab.withbureau.com)
is static assets on a Cloudflare Worker (`index.html` + `wrangler.toml` in the
repo root). It fires `name` / `company` / `email` at a Google Apps Script web
app, which is the code in this folder.

Apps Script rather than a Worker on purpose: `MailApp` sends as whichever Google
account owns the script, so switching the sender to `showroom.uk@withbureau.com`
is a config change, not a domain-verification project. The trade-off is that the
`.gs` source is not deployed from this repo - see *Deploying* below.

## What a sign-in does

| Step | Behaviour | Fails safe? |
|---|---|---|
| Append row to the sheet | Always | No - this is the one that matters |
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
| `appsscript.json` | Manifest - OAuth scopes, web app access |

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
   | `HUBSPOT_TOKEN` | HubSpot private app token | Optional - omit to skip HubSpot |
   | `SHEET_ID` | Sign-in spreadsheet id | Only if the script is **not** bound to the sheet |

   Scopes needed on the private app: `crm.objects.contacts.read`,
   `crm.objects.contacts.write`, and notes write. Same token convention as
   `service-request` / `install-complete-form` / `delivery-details`.

   Leave the property off entirely and the HubSpot step just skips - the sheet
   and the email still work.

5. **Deploy.** Deploy → Manage deployments → edit the existing deployment →
   New version → Deploy. Keep the same deployment so the `/exec` URL in
   `index.html` doesn't change. Execute as *me*, access *anyone*.

6. **Authorise.** First run asks for Sheets, Gmail send, external requests and
   Calendar. Approve as the account that should appear as the sender.

7. **Send yourself a test.** In the editor, run `testSignIn()` from
   `Test.gs` - it pushes a fake visitor through the whole path using your own
   address. Check the sheet row, the email, and the HubSpot contact.

## Checking your changes without deploying

Two node scripts under `apps-script/tests/` load the real `.gs` files, so they
cannot drift from what actually runs. Neither needs a HubSpot token, a Google
account, or a deployment.

```bash
node apps-script/tests/hubspot-dryrun.js
```

Stubs `UrlFetchApp` and asserts the HubSpot request shapes: that a new visitor
is created with `showroom_visit=Yes`, that an existing contact's curated name
and company are never overwritten, that a blank contact gets filled, that a 409
recovers and still records the visit, and that `lifecyclestage` is never
written. 18 checks.

```bash
node apps-script/tests/email-preview.js
```

Captures what `sendVisitorEmail` hands to `MailApp` and writes the rendered HTML
next to itself so you can open it in a browser. Prints the subject, sender,
reply-to and the plain-text alternative.

## The sender: showroom.uk@withbureau.com

`showroom.uk@withbureau.com` exists as of 14 Sep 2026. It is a full Workspace
mailbox with its own seat, not a group alias, so either wiring below works.
`CONFIG.FROM_ALIAS` is already set to it.

Kat's preference (and yours) was a separate showroom address rather than
routing this through sales, so this is that.

### Option A: keep the script on Nathan's account, send *as* the showroom

The quickest path and what the config is currently set up for.

1. In Gmail as nathan@withbureau.com: Settings → Accounts and Import →
   *Send mail as* → Add another email address.
2. Enter `showroom.uk@withbureau.com`, leave "Treat as an alias" ticked.
3. Gmail sends a verification code to the showroom.uk inbox. Open that inbox
   and paste the code back.
4. Redeploy the script.

Until step 3 is complete, `MailApp` refuses the `from` address. `Email.gs`
catches that, logs an error, and sends from the owner account instead, so
visitors still get their thank-you while the alias is pending. Check the
Executions log after the first real sign-in: if you see "could not send as
showroom.uk@withbureau.com", the alias isn't verified yet.

### Option B: move the script to the showroom account

Cleaner long-term. The showroom mailbox owns the automation, so it doesn't
break if Nathan's account is ever suspended or leaves, and there's no alias to
maintain.

1. Sign in as showroom.uk@withbureau.com.
2. Either transfer ownership of the existing sheet + bound script to it, or
   create a fresh sheet in its Drive and paste the `.gs` files in.
3. Set `CONFIG.FROM_ALIAS = ''` so it sends natively.
4. Add the `HUBSPOT_TOKEN` script property again on the new project. Script
   properties do not move with ownership transfers.
5. Deploy from that account. **The `/exec` URL will change**, so update
   `SCRIPT_URL` in `index.html` and redeploy the Worker.

### Reply-to

`REPLY_TO` is a separate knob and still points at Kat, so visitor replies land
with a human. Only point it at showroom.uk@ once someone is actually watching
that inbox, otherwise replies vanish into a mailbox nobody opens.

## The calendar question

You floated a 15-minute block per sign-in on the showroom calendar and flagged
it might "get all bunged up". Kat never gave a steer. It's written and off:
set `CREATE_CALENDAR_EVENT: true` and a `CALENDAR_ID` to try it. Easy to turn
off again if it's noise, which on a busy day it probably is.

## Deliverability

Sending from a real Google account means SPF/DKIM are already right for
`withbureau.com` - no DNS work. Worth knowing:

- `MailApp` on Workspace is capped around 1,500 recipients/day. A showroom will
  not get near that.
- The email is transactional (a courtesy note after a visit they opted into by
  signing in), so it doesn't need an unsubscribe footer. If it ever grows
  marketing content or a campaign link, that changes - it should move into
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
- **Two custom contact properties already existed**, and this writes them
  rather than inventing new ones:

  | Property | Type | Written |
  |---|---|---|
  | `showroom_visit` | enumeration, `Yes` / `No` | always set to `Yes` |
  | `showroom` | date, `yyyy-MM-dd` | always set to the visit date |

  Around 115 contacts already carry these, so Kat's "track showroom activity in
  HubSpot" is a filter on `showroom_visit = Yes`, not just timeline history.
  Verified against the live portal (44093193), including the exact `Yes`
  casing, which matters because HubSpot enumerations are value-exact.

- The visit *also* lands as a **timeline note**, for the detail the two
  properties can't carry (company as typed, time of day, which showroom).
