/**
 * Bureau showroom sign-in — configuration
 *
 * Everything you are likely to want to change lives in this file.
 * Secrets do NOT live here — they go in Script Properties (see SETUP.md),
 * because this repo is public.
 */

var CONFIG = {

  // ---------------------------------------------------------------- sheet
  SHEET_NAME: 'Sign-ins',

  // ---------------------------------------------------------------- showroom
  SHOWROOM_NAME: 'Bureau London',
  SHOWROOM_ADDRESS: '3 Albemarle Way, London EC1V 4JB',

  // ---------------------------------------------------------------- sender
  // FROM_ALIAS: '' means "send as whichever Google account owns this script".
  // Right now that is nathan@withbureau.com, which is what we want for now.
  //
  // When londonshowroom@withbureau.com (or similar) exists:
  //   1. Add it to the owning account as a Gmail "Send mail as" alias
  //      (Gmail → Settings → Accounts → Send mail as → Add another email address)
  //   2. Verify it, then put the address in FROM_ALIAS below.
  // That is the only change needed — no code edits.
  FROM_ALIAS: '',
  FROM_NAME: 'Bureau London Showroom',
  REPLY_TO: 'kathryn@withbureau.com',

  // ---------------------------------------------------------------- visitor email
  SEND_VISITOR_EMAIL: true,

  // Don't re-send the thank-you if the same person signs in again inside this
  // window. Stops regulars and repeat-visit-in-one-day people getting spammed.
  EMAIL_COOLDOWN_HOURS: 24,

  // ---------------------------------------------------------------- internal notify
  // Who gets a heads-up when someone signs in. Empty array = nobody.
  NOTIFY_INTERNAL: [],

  // ---------------------------------------------------------------- calendar
  // Nathan floated logging a 15-min block on the showroom calendar. Kat never
  // gave a steer and Nathan flagged it might "get all bunged up", so this is
  // OFF by default. Flip to true and set CALENDAR_ID to try it.
  CREATE_CALENDAR_EVENT: false,
  CALENDAR_ID: '',
  VISIT_MINUTES: 15,

  // ---------------------------------------------------------------- hubspot
  // Requires HUBSPOT_TOKEN in Script Properties. If the token is absent the
  // HubSpot step is skipped silently and the sheet + email still work.
  PUSH_TO_HUBSPOT: true,

  // ---------------------------------------------------------------- misc
  TIMEZONE: 'Europe/London'
};
