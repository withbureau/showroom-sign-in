const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');

// Load the REAL source files so the preview cannot drift from what actually sends.
// Code.gs is loaded for firstName()/esc() — nothing in it executes at load time.
const src = read('Config.gs') + '\n' + read('Code.gs') + '\n' + read('Email.gs');

// Faithful-enough stand-in for Utilities.formatDate so the preview shows the
// same strings the real template will produce.
function formatDate(date, tz, fmt) {
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const pad = n => String(n).padStart(2, '0');

  return fmt
    .replace(/EEEE/g, DAYS[date.getDay()])
    .replace(/EEE/g,  DAYS[date.getDay()].slice(0, 3))
    .replace(/MMMM/g, MONTHS[date.getMonth()])
    .replace(/MMM/g,  MONTHS[date.getMonth()].slice(0, 3))
    .replace(/yyyy/g, date.getFullYear())
    .replace(/HH/g,   pad(date.getHours()))
    .replace(/mm/g,   pad(date.getMinutes()))
    .replace(/\bd\b/g, date.getDate());
}

// Capture what sendVisitorEmail actually hands to MailApp, rather than
// re-deriving the subject here and letting the two drift apart.
const stubs = `
  var sent = null;
  var MailApp = { sendEmail: function (to, subject, body, options) {
    sent = { to: to, subject: subject, body: body, options: options };
  } };
  var Utilities = { formatDate: formatDate };
`;

const visitor = {
  name: 'Priya Raman',
  company: 'Fletcher & Co',
  email: 'priya@fletcherco.com',
  when: new Date()
};

const run = new Function('visitor', 'formatDate', stubs + src + `
  sendVisitorEmail(visitor);
  return {
    to: sent.to,
    subject: sent.subject,
    text: sent.body,
    html: sent.options.htmlBody,
    replyTo: sent.options.replyTo,
    fromName: sent.options.name,
    fromAlias: sent.options.from || '(owner account)',
    firstNameCheck: firstName(visitor.name)
  };
`);

const out = run(visitor, formatDate);

const outPath = path.join(__dirname, 'showroom-thankyou-preview.html');
fs.writeFileSync(outPath, out.html, 'utf8');

console.log('firstName("Priya Raman") -> ' + JSON.stringify(out.firstNameCheck));
console.log('TO:        ' + out.to);
console.log('SUBJECT:   ' + out.subject);
console.log('FROM NAME: ' + out.fromName);
console.log('FROM:      ' + out.fromAlias);
console.log('REPLY-TO:  ' + out.replyTo);
console.log('html bytes: ' + out.html.length);
console.log('written: ' + outPath);
console.log('\n--- PLAIN TEXT ---\n' + out.text);
