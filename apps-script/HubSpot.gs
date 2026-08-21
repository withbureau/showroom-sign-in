/**
 * Bureau showroom sign-in - HubSpot
 *
 * Follows the Bureau form-worker convention:
 *   - private app token in HUBSPOT_TOKEN (here: Script Properties, not .dev.vars)
 *   - search-then-create on contacts (the org uses no batch/upsert anywhere)
 *   - 409 on create == duplicate email, so re-search and reuse the id
 *   - best-effort: never allowed to fail the visitor's sign-in
 *   - HubSpot error bodies truncated to 300 chars in thrown messages
 *
 * Deliberate omissions, matching the rest of the org:
 *   - no lifecyclestage write (nothing in the org writes it; it would silently
 *     drag showroom walk-ins backwards through the funnel)
 *   - no Company object write (no /crm/v3/objects/companies write exists in the
 *     org) - the visitor's employer goes on the contact's `company` property
 *   - associations use the /crm/v4 "default" endpoint rather than a hardcoded
 *     associationTypeId, so there is no id to guess wrong
 */

var HS_BASE = 'https://api.hubapi.com';
var HS_PORTAL_ID = '44093193';

function hubspotToken() {
  return PropertiesService.getScriptProperties().getProperty('HUBSPOT_TOKEN');
}

/**
 * Upserts the visitor as a HubSpot contact and drops a note on their timeline.
 * Returns a short status string for the response payload.
 */
function pushToHubSpot(visitor) {
  var token = hubspotToken();
  if (!token) {
    console.log('[showroom] HUBSPOT_TOKEN not set - skipping HubSpot push');
    return 'skipped (no token)';
  }

  var contact = findContactByEmail(visitor.email, token);
  var created = false;

  if (contact) {
    fillContactBlanks(contact, visitor, token);
  } else {
    contact = createContact(visitor, token);
    created = true;
  }

  addVisitNote(contact.id, visitor, token);

  return (created ? 'contact created' : 'contact updated') +
         ' (' + contact.id + '), visit note added';
}

// ------------------------------------------------------------------ contacts

function findContactByEmail(email, token) {
  var res = hsFetch('/crm/v3/objects/contacts/search', token, {
    method: 'post',
    payload: {
      filterGroups: [{
        filters: [{ propertyName: 'email', operator: 'EQ', value: email }]
      }],
      properties: ['email', 'firstname', 'lastname', 'company'],
      limit: 1
    }
  });

  return (res && res.results && res.results.length) ? res.results[0] : null;
}

function createContact(visitor, token) {
  var parts = splitName(visitor.name);

  try {
    return hsFetch('/crm/v3/objects/contacts', token, {
      method: 'post',
      payload: {
        properties: {
          email:     visitor.email,
          firstname: parts.first,
          lastname:  parts.last,
          company:   visitor.company
        }
      }
    });
  } catch (err) {
    // 409 == a contact with this email already exists (race, or the search
    // index hadn't caught up). Re-search and reuse it.
    if (String(err).indexOf('409') !== -1) {
      var existing = findContactByEmail(visitor.email, token);
      if (existing) return existing;
    }
    throw err;
  }
}

/**
 * Only fills properties that are currently empty. We never overwrite a name or
 * company that sales has already curated just because someone typed something
 * different into a kiosk - same conservatism as loblaws-request-form, which
 * deliberately never overwrites an existing contact's phone.
 */
function fillContactBlanks(contact, visitor, token) {
  var current = contact.properties || {};
  var parts = splitName(visitor.name);
  var patch = {};

  if (!current.firstname && parts.first) patch.firstname = parts.first;
  if (!current.lastname  && parts.last)  patch.lastname  = parts.last;
  if (!current.company   && visitor.company) patch.company = visitor.company;

  if (!Object.keys(patch).length) return;

  hsFetch('/crm/v3/objects/contacts/' + contact.id, token, {
    method: 'patch',
    payload: { properties: patch }
  });
}

// ------------------------------------------------------------------ note

/**
 * A timeline note is how the showroom visit becomes visible in HubSpot without
 * needing any custom property created first. If you later add a custom date
 * property for "last showroom visit", patch it here too.
 */
function addVisitNote(contactId, visitor, token) {
  var when = Utilities.formatDate(visitor.when, CONFIG.TIMEZONE, 'EEEE d MMMM yyyy, HH:mm');

  var body =
    '<p><strong>Showroom visit: ' + esc(CONFIG.SHOWROOM_NAME) + '</strong></p>' +
    '<p>Signed in at the showroom kiosk.</p>' +
    '<ul>' +
      '<li>Name: ' + esc(visitor.name) + '</li>' +
      '<li>Company: ' + esc(visitor.company) + '</li>' +
      '<li>Email: ' + esc(visitor.email) + '</li>' +
      '<li>When: ' + esc(when) + '</li>' +
      '<li>Where: ' + esc(CONFIG.SHOWROOM_ADDRESS) + '</li>' +
    '</ul>';

  var note = hsFetch('/crm/v3/objects/notes', token, {
    method: 'post',
    payload: {
      properties: {
        hs_note_body: body,
        hs_timestamp: visitor.when.toISOString()
      }
    }
  });

  // Default association - avoids hardcoding an associationTypeId. The org has
  // a live 216-vs-228 discrepancy for note->ticket precisely because those get
  // guessed; "default" sidesteps the question.
  hsFetch('/crm/v4/objects/notes/' + note.id + '/associations/default/contacts/' + contactId,
          token, { method: 'put' });

  return note.id;
}

// ------------------------------------------------------------------ transport

function hsFetch(path, token, init) {
  init = init || {};

  var options = {
    method: init.method || 'get',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  };

  if (init.payload) options.payload = JSON.stringify(init.payload);

  var res = UrlFetchApp.fetch(HS_BASE + path, options);
  var code = res.getResponseCode();
  var text = res.getContentText();

  if (code < 200 || code >= 300) {
    throw new Error('HubSpot ' + code + ' on ' + path + ': ' + String(text).slice(0, 300));
  }

  if (code === 204 || !text) return null;

  try {
    return JSON.parse(text);
  } catch (err) {
    return null;
  }
}

// ------------------------------------------------------------------ util

function splitName(fullName) {
  var bits = String(fullName || '').trim().split(/\s+/).filter(String);

  if (!bits.length)      return { first: '', last: '' };
  if (bits.length === 1) return { first: bits[0], last: '' };

  return {
    first: bits[0],
    last:  bits.slice(1).join(' ')
  };
}

/** Convenience link for a contact record, handy in logs. */
function hubspotContactUrl(contactId) {
  return 'https://app.hubspot.com/contacts/' + HS_PORTAL_ID + '/record/0-1/' + contactId;
}
