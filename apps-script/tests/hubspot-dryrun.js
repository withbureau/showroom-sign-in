/**
 * Dry-run of HubSpot.gs against a stubbed UrlFetchApp.
 * Verifies request shapes without needing a real token.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const dir = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
const src = read('Config.gs') + '\n' + read('Code.gs') + '\n' +
            read('Email.gs') + '\n' + read('HubSpot.gs');

function formatDate(date, tz, fmt) {
  const pad = n => String(n).padStart(2, '0');
  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  return fmt
    .replace(/EEEE/g, DAYS[date.getDay()])
    .replace(/yyyy/g, date.getFullYear())
    .replace(/MMMM/g, MONTHS[date.getMonth()])
    .replace(/MM/g, pad(date.getMonth() + 1))
    .replace(/dd/g, pad(date.getDate()))
    .replace(/HH/g, pad(date.getHours()))
    .replace(/mm/g, pad(date.getMinutes()))
    .replace(/\bd\b/g, date.getDate());
}

// Build a run with a scripted set of HubSpot responses.
function run(scenario, responses) {
  const calls = [];

  const harness = new Function('visitor', 'formatDate', 'calls', 'responses', `
    var PropertiesService = { getScriptProperties: function () {
      return { getProperty: function (k) { return k === 'HUBSPOT_TOKEN' ? 'fake-token' : null; } };
    } };
    var Utilities = { formatDate: formatDate };
    var console = { log: function () {}, error: function () {}, warn: function () {} };
    var UrlFetchApp = { fetch: function (url, options) {
      var body = options.payload ? JSON.parse(options.payload) : null;
      calls.push({ method: options.method, url: url, body: body,
                   auth: options.headers.Authorization });
      var r = responses.shift();
      if (!r) throw new Error('unexpected extra HubSpot call: ' + options.method + ' ' + url);
      return {
        getResponseCode: function () { return r.code; },
        getContentText: function () { return JSON.stringify(r.body || {}); }
      };
    } };
    ${src}
    return pushToHubSpot(visitor);
  `);

  const visitor = {
    name: 'Priya Raman',
    company: 'Fletcher & Co',
    email: 'priya@fletcherco.com',
    when: new Date(2026, 7, 21, 14, 30)
  };

  const status = harness(visitor, formatDate, calls, responses.slice());
  return { calls, status };
}

let failures = 0;
function check(label, fn) {
  try { fn(); console.log('  PASS  ' + label); }
  catch (e) { failures++; console.log('  FAIL  ' + label + '\n        ' + e.message); }
}

// ---------------------------------------------------------------- scenario 1
console.log('\n1. Brand-new visitor (no existing contact)');
{
  const { calls, status } = run('new', [
    { code: 200, body: { results: [] } },                 // search: miss
    { code: 201, body: { id: '555' } },                   // create contact
    { code: 201, body: { id: '999' } },                   // create note
    { code: 204, body: null }                             // associate
  ]);

  check('searches contacts by email first', () => {
    assert.strictEqual(calls[0].url, 'https://api.hubapi.com/crm/v3/objects/contacts/search');
    assert.strictEqual(calls[0].body.filterGroups[0].filters[0].propertyName, 'email');
    assert.strictEqual(calls[0].body.filterGroups[0].filters[0].value, 'priya@fletcherco.com');
  });
  check('creates the contact with showroom_visit=Yes', () => {
    assert.strictEqual(calls[1].method, 'post');
    assert.strictEqual(calls[1].url, 'https://api.hubapi.com/crm/v3/objects/contacts');
    assert.strictEqual(calls[1].body.properties.showroom_visit, 'Yes');
  });
  check('creates it with showroom = yyyy-MM-dd', () => {
    assert.strictEqual(calls[1].body.properties.showroom, '2026-08-21');
  });
  check('splits the name correctly', () => {
    assert.strictEqual(calls[1].body.properties.firstname, 'Priya');
    assert.strictEqual(calls[1].body.properties.lastname, 'Raman');
    assert.strictEqual(calls[1].body.properties.company, 'Fletcher & Co');
  });
  check('never writes lifecyclestage', () => {
    assert.ok(!('lifecyclestage' in calls[1].body.properties));
  });
  check('sends a bearer token', () => {
    assert.strictEqual(calls[1].auth, 'Bearer fake-token');
  });
  check('creates a note with hs_note_body + hs_timestamp', () => {
    assert.strictEqual(calls[2].url, 'https://api.hubapi.com/crm/v3/objects/notes');
    assert.ok(calls[2].body.properties.hs_note_body.includes('Fletcher &amp; Co'),
      'company should be HTML-escaped in the note body');
    assert.ok(calls[2].body.properties.hs_timestamp);
  });
  check('associates note to contact via the v4 default endpoint', () => {
    assert.strictEqual(calls[3].method, 'put');
    assert.strictEqual(calls[3].url,
      'https://api.hubapi.com/crm/v4/objects/notes/999/associations/default/contacts/555');
  });
  check('makes exactly 4 calls', () => assert.strictEqual(calls.length, 4));
  console.log('        status: ' + status);
}

// ---------------------------------------------------------------- scenario 2
console.log('\n2. Existing contact, name and company already curated');
{
  const { calls, status } = run('curated', [
    { code: 200, body: { results: [{ id: '777', properties: {
        email: 'priya@fletcherco.com', firstname: 'Priyanka',
        lastname: 'Raman-Shah', company: 'Fletcher and Company Ltd' } }] } },
    { code: 200, body: { id: '777' } },                   // patch
    { code: 201, body: { id: '888' } },                   // note
    { code: 204, body: null }                             // associate
  ]);

  check('patches the existing contact, does not create', () => {
    assert.strictEqual(calls[1].method, 'patch');
    assert.strictEqual(calls[1].url, 'https://api.hubapi.com/crm/v3/objects/contacts/777');
  });
  check('still records the visit', () => {
    assert.strictEqual(calls[1].body.properties.showroom_visit, 'Yes');
    assert.strictEqual(calls[1].body.properties.showroom, '2026-08-21');
  });
  check('does NOT overwrite curated firstname/lastname/company', () => {
    const p = calls[1].body.properties;
    assert.ok(!('firstname' in p), 'firstname should not be touched');
    assert.ok(!('lastname' in p), 'lastname should not be touched');
    assert.ok(!('company' in p), 'company should not be touched');
  });
  console.log('        status: ' + status);
}

// ---------------------------------------------------------------- scenario 3
console.log('\n3. Existing contact with blank name and company');
{
  const { calls } = run('blank', [
    { code: 200, body: { results: [{ id: '321', properties: {
        email: 'priya@fletcherco.com' } }] } },
    { code: 200, body: { id: '321' } },
    { code: 201, body: { id: '654' } },
    { code: 204, body: null }
  ]);

  check('fills the blanks', () => {
    const p = calls[1].body.properties;
    assert.strictEqual(p.firstname, 'Priya');
    assert.strictEqual(p.lastname, 'Raman');
    assert.strictEqual(p.company, 'Fletcher & Co');
    assert.strictEqual(p.showroom_visit, 'Yes');
  });
}

// ---------------------------------------------------------------- scenario 4
console.log('\n4. Race: search misses, create returns 409');
{
  const { calls, status } = run('409', [
    { code: 200, body: { results: [] } },                 // search: miss
    { code: 409, body: { message: 'Contact already exists' } },
    { code: 200, body: { results: [{ id: '111', properties: {
        email: 'priya@fletcherco.com', firstname: 'Priya' } }] } },
    { code: 200, body: { id: '111' } },                   // patch
    { code: 201, body: { id: '222' } },
    { code: 204, body: null }
  ]);

  check('re-searches after the 409', () => {
    assert.strictEqual(calls[2].url, 'https://api.hubapi.com/crm/v3/objects/contacts/search');
  });
  check('still writes the showroom props on the recovered contact', () => {
    assert.strictEqual(calls[3].method, 'patch');
    assert.strictEqual(calls[3].body.properties.showroom_visit, 'Yes');
  });
  check('still attaches the note', () => {
    assert.strictEqual(calls[4].url, 'https://api.hubapi.com/crm/v3/objects/notes');
  });
  console.log('        status: ' + status);
}

// ---------------------------------------------------------------- scenario 5
console.log('\n5. Single-word name');
{
  const calls = [];
  const harness = new Function('formatDate', `
    var Utilities = { formatDate: formatDate };
    ${src}
    return [splitName('Cher'), splitName('Ana Maria de Souza'), splitName('  ')];
  `);
  const [one, many, empty] = harness(formatDate);
  check('single word -> firstname only', () => {
    assert.deepStrictEqual(one, { first: 'Cher', last: '' });
  });
  check('multi-part surname stays together', () => {
    assert.deepStrictEqual(many, { first: 'Ana', last: 'Maria de Souza' });
  });
  check('blank name does not throw', () => {
    assert.deepStrictEqual(empty, { first: '', last: '' });
  });
}

console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'All checks passed.') + '\n');
process.exit(failures ? 1 : 0);
