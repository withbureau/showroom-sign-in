/**
 * Bureau showroom sign-in — outbound email
 *
 * Styling matches the existing Bureau customer email (the delivery-details
 * verification-code mail): off-white ground, white card with a 2px steel-blue
 * border, Canary Yellow accent, Courier eyebrow, Arial Narrow display line.
 *
 * Deliberately NO webfonts. Per BUREAU_BRAND_GUIDELINES the email/Office
 * fallback for National 2 Condensed is Arial Narrow, and for Acid Grotesk it
 * is Arial. The kiosk's Space Grotesk is a one-off on that page, not brand.
 */

var BRAND = {
  offWhite:  '#F7F4E7',
  steelBlue: '#213741',
  midGrey:   '#647170',
  warmGrey:  '#C4C3C1',
  canary:    '#FFFD6D',
  redOrange: '#FF603B',
  card:      '#ffffff',

  display: "'Arial Narrow', 'Helvetica Condensed', Arial, sans-serif",
  body:    "Helvetica, Arial, sans-serif",
  mono:    "'Courier New', Courier, monospace"
};

function sendVisitorEmail(visitor) {
  var subject = 'Thanks for visiting ' + CONFIG.SHOWROOM_NAME;

  var options = {
    name:     CONFIG.FROM_NAME,
    htmlBody: visitorEmailHtml(visitor),
    replyTo:  CONFIG.REPLY_TO
  };

  // '' = send as the account that owns the script. Set FROM_ALIAS once
  // londonshowroom@withbureau.com exists as a verified Gmail alias.
  if (CONFIG.FROM_ALIAS) options.from = CONFIG.FROM_ALIAS;

  MailApp.sendEmail(
    visitor.email,
    subject,
    visitorEmailText(visitor),   // plain-text alternative
    options
  );
}

// ------------------------------------------------------------------ html

function visitorEmailHtml(visitor) {
  var name = firstName(visitor.name);
  var visited = Utilities.formatDate(visitor.when, CONFIG.TIMEZONE, 'EEEE d MMMM yyyy');

  return [
'<!DOCTYPE html>',
'<html><head><meta charset="utf-8">',
'<meta name="viewport" content="width=device-width, initial-scale=1">',
'<title>Thanks for visiting</title>',
'</head>',
'<body style="margin:0;padding:0;background:' + BRAND.offWhite + ';">',

// preheader — inbox preview line, hidden in the body
'<div style="display:none;max-height:0;overflow:hidden;opacity:0;">',
  'Good to have you at the showroom &mdash; we&rsquo;re here if you need anything.',
'</div>',

'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:' + BRAND.offWhite + ';">',
'<tr><td align="center" style="padding:36px 16px 20px;">',

  // ---------------------------------------------------------------- card
  '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:520px;background:' + BRAND.card + ';border:2px solid ' + BRAND.steelBlue + ';border-radius:18px;">',
  '<tr><td style="padding:40px;">',

    // eyebrow: canary dot + mono label
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>',
      '<td style="padding-right:8px;">',
        '<div style="width:8px;height:8px;background:' + BRAND.canary + ';border-radius:50%;"></div>',
      '</td>',
      '<td style="font-family:' + BRAND.mono + ';font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:' + BRAND.midGrey + ';">',
        'Bureau &middot; London Showroom',
      '</td>',
    '</tr></table>',

    // headline — sentence case, full stop, per house style
    '<h1 style="margin:26px 0 0;font-family:' + BRAND.display + ';font-weight:700;font-size:42px;line-height:0.95;letter-spacing:-0.02em;color:' + BRAND.steelBlue + ';">',
      'Thanks for stopping by, ' + esc(name) + '.',
    '</h1>',

    // body copy
    '<div style="font-family:' + BRAND.body + ';font-size:16px;line-height:1.5;color:' + BRAND.steelBlue + ';">',
      '<p style="margin:24px 0 16px;">It was good to have you at the showroom. We hope you got a proper feel for how the booths actually look, sound and sit in a space &mdash; the bit that never quite comes across in a PDF.</p>',
      '<p style="margin:0 0 16px;">If anything caught your eye, or you&rsquo;d like drawings, finishes or pricing worked up for a specific space, just reply to this email and we&rsquo;ll get it over to you.</p>',
      '<p style="margin:0;">And if you&rsquo;re ever passing and fancy another look, the door&rsquo;s open.</p>',
    '</div>',

    // visit record callout
    '<div style="margin:28px 0 0;background:rgba(255,253,109,0.18);border-left:3px solid ' + BRAND.canary + ';border-radius:12px;padding:18px 20px;">',
      '<div style="font-family:' + BRAND.mono + ';font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:' + BRAND.midGrey + ';padding-bottom:8px;">',
        'Your visit',
      '</div>',
      '<div style="font-family:' + BRAND.body + ';font-size:15px;line-height:1.6;color:' + BRAND.steelBlue + ';">',
        esc(visitor.company) + '<br>',
        esc(visited) + '<br>',
        esc(CONFIG.SHOWROOM_ADDRESS),
      '</div>',
    '</div>',

    // sign-off
    '<div style="margin:30px 0 0;padding-top:22px;border-top:1px solid ' + BRAND.warmGrey + ';font-family:' + BRAND.body + ';font-size:16px;line-height:1.5;color:' + BRAND.steelBlue + ';">',
      'The Bureau team',
    '</div>',

    // data note
    '<div style="margin:22px 0 0;font-family:' + BRAND.body + ';font-size:12px;line-height:1.6;color:' + BRAND.midGrey + ';">',
      'You&rsquo;re getting this because you signed in at our showroom. We keep a visit ',
      'record so we can account for everyone in a fire alarm or evacuation. ',
      'Reply to this email if you&rsquo;d like us to delete your details.',
    '</div>',

  '</td></tr>',
  '</table>',

  // ---------------------------------------------------------------- sign-off strip (outside the card)
  '<div style="max-width:520px;padding:22px 8px 0;font-family:' + BRAND.mono + ';font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:' + BRAND.midGrey + ';text-align:center;">',
    'Bureau &middot; Furnish a workspace that works',
  '</div>',

'</td></tr>',
'</table>',
'</body></html>'
  ].join('');
}

// ------------------------------------------------------------------ plain text

function visitorEmailText(visitor) {
  var name = firstName(visitor.name);
  var visited = Utilities.formatDate(visitor.when, CONFIG.TIMEZONE, 'EEEE d MMMM yyyy');

  return [
    'BUREAU - LONDON SHOWROOM',
    '',
    'Thanks for stopping by, ' + name + '.',
    '',
    'It was good to have you at the showroom. We hope you got a proper feel for',
    'how the booths actually look, sound and sit in a space - the bit that never',
    'quite comes across in a PDF.',
    '',
    'If anything caught your eye, or you\'d like drawings, finishes or pricing',
    'worked up for a specific space, just reply to this email and we\'ll get it',
    'over to you.',
    '',
    'And if you\'re ever passing and fancy another look, the door\'s open.',
    '',
    'YOUR VISIT',
    visitor.company,
    visited,
    CONFIG.SHOWROOM_ADDRESS,
    '',
    'The Bureau team',
    '',
    '--',
    'Bureau - Furnish a workspace that works',
    '',
    'You\'re getting this because you signed in at our showroom. We keep a visit',
    'record so we can account for everyone in a fire alarm or evacuation. Reply',
    'to this email if you\'d like us to delete your details.'
  ].join('\n');
}

// ------------------------------------------------------------------ internal

function sendInternalNotification(visitor, repeat) {
  var when = Utilities.formatDate(visitor.when, CONFIG.TIMEZONE, 'EEE d MMM, HH:mm');

  var html =
    '<div style="font-family:' + BRAND.body + ';font-size:15px;line-height:1.6;color:' + BRAND.steelBlue + ';">' +
      '<div style="font-family:' + BRAND.mono + ';font-size:11px;font-weight:700;letter-spacing:0.16em;' +
        'text-transform:uppercase;color:' + BRAND.midGrey + ';padding-bottom:14px;">' +
        'Bureau &middot; Showroom sign-in' +
      '</div>' +
      '<p style="margin:0 0 14px;"><strong>' + esc(visitor.name) + '</strong> ' +
        '(' + esc(visitor.company) + ') just signed in at the showroom.</p>' +
      '<p style="margin:0 0 6px;">Email: <a href="mailto:' + esc(visitor.email) + '" ' +
        'style="color:' + BRAND.steelBlue + ';">' + esc(visitor.email) + '</a></p>' +
      '<p style="margin:0;">Time: ' + esc(when) + '</p>' +
      (repeat
        ? '<p style="margin:16px 0 0;padding:12px 14px;background:rgba(255,253,109,0.18);' +
          'border-left:3px solid ' + BRAND.canary + ';border-radius:8px;color:' + BRAND.midGrey + ';">' +
          'Repeat visit inside ' + CONFIG.EMAIL_COOLDOWN_HOURS + 'h &mdash; no thank-you email sent.</p>'
        : '') +
    '</div>';

  MailApp.sendEmail({
    to: CONFIG.NOTIFY_INTERNAL.join(','),
    subject: 'Showroom sign-in: ' + visitor.name + ' (' + visitor.company + ')',
    htmlBody: html,
    body: visitor.name + ' (' + visitor.company + ') signed in at ' + when +
          '. Email: ' + visitor.email,
    name: CONFIG.FROM_NAME
  });
}

// ------------------------------------------------------------------ util

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
