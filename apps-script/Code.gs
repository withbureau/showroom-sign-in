/**
 * Bureau showroom sign-in - entry point
 *
 * Front end: https://showroom.lab.withbureau.com  (withbureau/showroom-sign-in)
 * The kiosk sends name / company / email and this script:
 *   1. appends a row to the sign-in sheet          (always)
 *   2. emails the visitor a thank-you              (CONFIG.SEND_VISITOR_EMAIL)
 *   3. upserts them into HubSpot as a showroom visitor (CONFIG.PUSH_TO_HUBSPOT)
 *   4. optionally drops a 15-min block on a calendar (CONFIG.CREATE_CALENDAR_EVENT)
 *
 * Steps 2-4 are best-effort: if any of them throw, the sign-in is still
 * recorded and the kiosk still shows "welcome". A visitor standing at an iPad
 * should never see a failure because HubSpot was having a moment.
 */

function doGet(e)  { return handle(e); }
function doPost(e) { return handle(e); }

function handle(e) {
  try {
    var visitor = readVisitor(e);

    if (!visitor.name || !visitor.company || !isValidEmail(visitor.email)) {
      return json({ ok: false, error: 'name, company and a valid email are required' });
    }

    // Serialise sheet writes so two people signing in at once can't collide.
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    var repeat;
    try {
      repeat = isRepeatVisit(visitor.email);
      appendRow(visitor, repeat);
    } finally {
      lock.releaseLock();
    }

    // ---- best-effort side effects ----
    var results = {};

    results.email = attempt('visitor email', function () {
      if (!CONFIG.SEND_VISITOR_EMAIL) return 'disabled';
      if (repeat)                     return 'skipped (signed in within cooldown)';
      sendVisitorEmail(visitor);
      return 'sent';
    });

    results.hubspot = attempt('hubspot', function () {
      if (!CONFIG.PUSH_TO_HUBSPOT) return 'disabled';
      return pushToHubSpot(visitor);
    });

    results.calendar = attempt('calendar', function () {
      if (!CONFIG.CREATE_CALENDAR_EVENT) return 'disabled';
      createVisitEvent(visitor);
      return 'created';
    });

    results.notify = attempt('internal notify', function () {
      if (!CONFIG.NOTIFY_INTERNAL || !CONFIG.NOTIFY_INTERNAL.length) return 'disabled';
      sendInternalNotification(visitor, repeat);
      return 'sent';
    });

    return json({ ok: true, repeat: repeat, results: results });

  } catch (err) {
    // Last-resort: log it so a lost sign-in is at least traceable.
    console.error('sign-in failed: ' + err);
    return json({ ok: false, error: String(err) });
  }
}

/**
 * Runs fn, swallowing and logging any error so one broken integration
 * cannot take down the sign-in.
 */
function attempt(label, fn) {
  try {
    return fn();
  } catch (err) {
    console.error(label + ' failed: ' + err);
    return 'failed: ' + err;
  }
}

// ------------------------------------------------------------------ input

function readVisitor(e) {
  var p = (e && e.parameter) ? e.parameter : {};

  // Accept a JSON body too, in case we ever move the kiosk to POST.
  if (e && e.postData && e.postData.contents) {
    try {
      var body = JSON.parse(e.postData.contents);
      Object.keys(body).forEach(function (k) { if (!p[k]) p[k] = body[k]; });
    } catch (ignored) { /* form-encoded, already in e.parameter */ }
  }

  return {
    name:    clean(p.name),
    company: clean(p.company),
    email:   clean(p.email).toLowerCase(),
    when:    new Date()
  };
}

function clean(v) {
  return String(v == null ? '' : v).trim().replace(/\s+/g, ' ').slice(0, 200);
}

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function firstName(fullName) {
  return (fullName || '').trim().split(/\s+/)[0] || 'there';
}

// ------------------------------------------------------------------ sheet

/**
 * Resolves the sign-in spreadsheet.
 *
 * Works whether the script is bound to the sheet (Extensions → Apps Script) or
 * standalone. If it's standalone, put the sheet id in a SHEET_ID Script
 * Property - getActiveSpreadsheet() returns null for standalone scripts, which
 * would otherwise fail with a confusing "cannot read property of null".
 */
function getSpreadsheet() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error(
      'No spreadsheet found. This script is not bound to a sheet, so set a ' +
      'SHEET_ID script property to the sign-in sheet id.'
    );
  }
  return ss;
}

function getSheet() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Timestamp', 'Name', 'Company', 'Email', 'Showroom', 'Repeat visit']);
    sheet.getRange(1, 1, 1, 6).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function appendRow(visitor, repeat) {
  getSheet().appendRow([
    visitor.when,
    visitor.name,
    visitor.company,
    visitor.email,
    CONFIG.SHOWROOM_NAME,
    repeat ? 'yes' : ''
  ]);
}

/**
 * True if this email signed in within EMAIL_COOLDOWN_HOURS.
 * Reads the tail of the sheet rather than the whole thing so this stays fast
 * as the log grows.
 */
function isRepeatVisit(email) {
  if (!CONFIG.EMAIL_COOLDOWN_HOURS) return false;

  var sheet = getSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  var lookback = 500;
  var startRow = Math.max(2, lastRow - lookback + 1);
  var rows = sheet.getRange(startRow, 1, lastRow - startRow + 1, 4).getValues();

  var cutoff = Date.now() - (CONFIG.EMAIL_COOLDOWN_HOURS * 3600 * 1000);

  for (var i = rows.length - 1; i >= 0; i--) {
    var ts = rows[i][0];
    var rowEmail = String(rows[i][3] || '').trim().toLowerCase();
    var time = (ts instanceof Date) ? ts.getTime() : Date.parse(ts);

    if (!time || time < cutoff) break;      // rows are chronological; older than cutoff = done
    if (rowEmail === email) return true;
  }

  return false;
}

// ------------------------------------------------------------------ calendar

function createVisitEvent(visitor) {
  var calendar = CONFIG.CALENDAR_ID
    ? CalendarApp.getCalendarById(CONFIG.CALENDAR_ID)
    : CalendarApp.getDefaultCalendar();

  if (!calendar) throw new Error('calendar not found: ' + CONFIG.CALENDAR_ID);

  var start = visitor.when;
  var end = new Date(start.getTime() + CONFIG.VISIT_MINUTES * 60 * 1000);

  calendar.createEvent(
    'Showroom visit: ' + visitor.name + ' (' + visitor.company + ')',
    start,
    end,
    {
      description: 'Signed in at the ' + CONFIG.SHOWROOM_NAME + ' showroom kiosk.\n\n' +
                   'Name: ' + visitor.name + '\n' +
                   'Company: ' + visitor.company + '\n' +
                   'Email: ' + visitor.email,
      location: CONFIG.SHOWROOM_ADDRESS
    }
  );
}

// ------------------------------------------------------------------ util

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
