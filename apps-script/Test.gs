/**
 * Bureau showroom sign-in - manual test helpers
 *
 * Run these from the Apps Script editor (select the function, press Run).
 * They are not called by the web app.
 */

/**
 * Your own address, for sending test mail to. getActiveUser() can come back
 * empty depending on how the script is run, so fall back to the effective user.
 */
function whoAmI() {
  var me = '';
  try { me = Session.getActiveUser().getEmail(); } catch (ignored) {}
  if (!me) {
    try { me = Session.getEffectiveUser().getEmail(); } catch (ignored) {}
  }
  if (!me) {
    throw new Error('Could not resolve your email address - hardcode it in whoAmI() to test.');
  }
  return me;
}

/**
 * Pushes a fake visitor through the whole path - sheet row, thank-you email,
 * HubSpot contact + note - using your own email address as the visitor.
 *
 * Check afterwards: the sheet row, your inbox, and the HubSpot contact.
 * Then delete the test row and the test contact.
 */
function testSignIn() {
  var me = whoAmI();

  var result = handle({
    parameter: {
      name: 'Test Visitor',
      company: 'Bureau (test)',
      email: me
    }
  });

  var payload = result.getContent();
  console.log('testSignIn -> ' + payload);
  console.log('Sent to: ' + me);
  console.log('Remember to delete the test row and the test HubSpot contact.');

  return payload;
}

/**
 * Renders the thank-you email and emails it to you WITHOUT touching the sheet,
 * HubSpot or the calendar. Use this when iterating on copy or layout.
 */
function testEmailOnly() {
  var me = whoAmI();

  sendVisitorEmail({
    name: 'Priya Raman',
    company: 'Fletcher & Co',
    email: me,
    when: new Date()
  });

  console.log('Preview thank-you email sent to ' + me);
}

/**
 * Checks the HubSpot token works and reports which account it's pointed at,
 * without writing anything.
 */
function testHubSpotConnection() {
  var token = hubspotToken();

  if (!token) {
    console.log('HUBSPOT_TOKEN is not set in Script Properties - HubSpot push is disabled.');
    return;
  }

  var account = hsFetch('/account-info/v3/details', token, {});
  console.log('HubSpot OK - portal ' + account.portalId + ' (' + account.timeZone + ')');

  if (String(account.portalId) !== HS_PORTAL_ID) {
    console.warn('Portal ' + account.portalId + ' is not the expected Bureau portal ' + HS_PORTAL_ID);
  }
}

/**
 * Confirms the repeat-visit lookup behaves, using the current sheet contents.
 */
function testRepeatVisitCheck() {
  var sheet = getSheet();
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    console.log('Sheet has no sign-ins yet - nothing to check.');
    return;
  }

  var mostRecentEmail = String(sheet.getRange(lastRow, 4).getValue() || '').trim().toLowerCase();

  console.log('Most recent sign-in: ' + mostRecentEmail);
  console.log('  treated as repeat? ' + isRepeatVisit(mostRecentEmail) +
              '   (cooldown ' + CONFIG.EMAIL_COOLDOWN_HOURS + 'h)');
  console.log('Never-seen address treated as repeat? ' +
              isRepeatVisit('definitely-not-a-real-visitor@example.com') + '   (expected: false)');
}
