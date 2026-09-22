/**
 * Bureau showroom sign-in - configuration
 *
 * Everything you are likely to want to change lives in this file.
 * Secrets do NOT live here - they go in Script Properties (see SETUP.md),
 * because this repo is public.
 */

var CONFIG = {

  // ---------------------------------------------------------------- sheet
  SHEET_NAME: 'Sign-ins',

  // ---------------------------------------------------------------- showroom
  SHOWROOM_NAME: 'Bureau London',
  SHOWROOM_ADDRESS: '3 Albemarle Way, London EC1V 4JB',

  // ---------------------------------------------------------------- sender
  // showroom.uk@withbureau.com is a full Workspace mailbox Parker set up on
  // 14 Sep 2026. Two ways to send as it, pick one (see SETUP.md):
  //
  //   A) Script stays owned by nathan@withbureau.com and sends AS the
  //      showroom address. Needs showroom.uk@ added and verified as a Gmail
  //      "Send mail as" alias on Nathan's account first. If that hasn't been
  //      done yet, Email.gs logs the failure and falls back to sending from
  //      the owner, so visitors still get their thank-you.
  //
  //   B) Script and sheet are owned by showroom.uk@ itself. Then set this to
  //      '' and it sends natively, no alias needed. Cleaner long-term.
  FROM_ALIAS: 'showroom.uk@withbureau.com',
  FROM_NAME: 'Bureau London Showroom',

  // Replies go to a human. Change to showroom.uk@withbureau.com only once
  // someone is actually watching that inbox.
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
