const PLAY_LINK = 'https://play.google.com/apps/testing/com.raitta.fi';

const ADDED_STEP = {
  en: 'Your Google account is already in the test: no need to wait.',
  fi: 'Google-tilisi on jo mukana testissä: odottaa ei tarvitse.',
  sv: 'Ditt Google-konto är redan med i testet: du behöver inte vänta.',
  ru: 'Ваш Google-аккаунт уже добавлен в тест: ждать не нужно.',
  et: 'Sinu Google’i konto on juba testis: ootama ei pea.',
};

const TEXT = {
  en: {
    subject: 'You are signed up to test RAITTA',
    hello: (name) => (name ? `Hi ${name},` : 'Hi,'),
    intro: 'Thank you for signing up to test the RAITTA Android app. This is what you sent us:',
    email: 'Google account', name: 'Name', device: 'Phone', city: 'City',
    nextTitle: 'What happens next',
    steps: [
      'Within 1–2 days we add your Google account to the test on Google Play.',
      'Then open the link below on your Android phone, signed in with the same Google account, and tap “Become a tester”.',
      'Install RAITTA from Google Play and keep it installed for at least 14 days.',
    ],
    button: 'Join the test on Google Play',
    feedback: 'Found a bug or have an idea? Tell us at raitta.fi/feedback or simply reply to this email.',
    notYou: 'Did not sign up? Then someone typed your address by mistake. Ignore this email, or write to privacy@raitta.fi and we delete it.',
    footer: 'RAITTA is an independent app and is not affiliated with any transport authority.',
  },
  fi: {
    subject: 'Olet ilmoittautunut RAITTAn testaajaksi',
    hello: (name) => (name ? `Hei ${name},` : 'Hei,'),
    intro: 'Kiitos, että ilmoittauduit RAITTAn Android-sovelluksen testaajaksi. Lähetit meille nämä tiedot:',
    email: 'Google-tili', name: 'Nimi', device: 'Puhelin', city: 'Kaupunki',
    nextTitle: 'Mitä seuraavaksi',
    steps: [
      'Lisäämme Google-tilisi Google Playn testiin 1–2 päivän kuluessa.',
      'Avaa sitten alla oleva linkki Android-puhelimella samalla Google-tilillä ja napauta ”Ryhdy testaajaksi”.',
      'Asenna RAITTA Google Playsta ja pidä se asennettuna ainakin 14 päivää.',
    ],
    button: 'Liity testiin Google Playssa',
    feedback: 'Löysitkö virheen tai onko sinulla idea? Kerro osoitteessa raitta.fi/feedback tai vastaa tähän viestiin.',
    notYou: 'Etkö ilmoittautunut? Joku on kirjoittanut osoitteesi vahingossa. Voit jättää viestin huomiotta tai kirjoittaa osoitteeseen privacy@raitta.fi, niin poistamme sen.',
    footer: 'RAITTA on itsenäinen sovellus, eikä se liity joukkoliikenneviranomaisiin.',
  },
  sv: {
    subject: 'Du är anmäld som testare av RAITTA',
    hello: (name) => (name ? `Hej ${name},` : 'Hej,'),
    intro: 'Tack för att du anmälde dig som testare av RAITTAs Android-app. Det här skickade du till oss:',
    email: 'Google-konto', name: 'Namn', device: 'Telefon', city: 'Stad',
    nextTitle: 'Så går det till',
    steps: [
      'Inom 1–2 dagar lägger vi till ditt Google-konto i testet på Google Play.',
      'Öppna sedan länken nedan på din Android-telefon, inloggad med samma Google-konto, och tryck på ”Bli testare”.',
      'Installera RAITTA från Google Play och ha appen kvar i minst 14 dagar.',
    ],
    button: 'Gå med i testet på Google Play',
    feedback: 'Hittat ett fel eller har en idé? Berätta på raitta.fi/feedback eller svara på det här mejlet.',
    notYou: 'Anmälde du dig inte? Då har någon skrivit din adress av misstag. Strunta i mejlet, eller skriv till privacy@raitta.fi så tar vi bort den.',
    footer: 'RAITTA är en fristående app utan koppling till någon trafikmyndighet.',
  },
  ru: {
    subject: 'Вы записались в тестировщики RAITTA',
    hello: (name) => (name ? `Здравствуйте, ${name}!` : 'Здравствуйте!'),
    intro: 'Спасибо, что записались в тестировщики Android-приложения RAITTA. Вот что вы нам отправили:',
    email: 'Google-аккаунт', name: 'Имя', device: 'Телефон', city: 'Город',
    nextTitle: 'Что дальше',
    steps: [
      'В течение 1–2 дней мы добавим ваш Google-аккаунт в тест в Google Play.',
      'Затем откройте ссылку ниже на Android-телефоне, войдя в тот же Google-аккаунт, и нажмите «Стать тестировщиком».',
      'Установите RAITTA из Google Play и не удаляйте приложение хотя бы 14 дней.',
    ],
    button: 'Присоединиться к тесту в Google Play',
    feedback: 'Нашли ошибку или есть идея? Напишите на raitta.fi/feedback или просто ответьте на это письмо.',
    notYou: 'Вы не записывались? Значит, кто-то ввёл ваш адрес по ошибке. Просто не обращайте внимания на письмо или напишите на privacy@raitta.fi, и мы его удалим.',
    footer: 'RAITTA — независимое приложение, не связанное с транспортными организациями.',
  },
  et: {
    subject: 'Oled RAITTA testijaks registreeritud',
    hello: (name) => (name ? `Tere, ${name}!` : 'Tere!'),
    intro: 'Aitäh, et registreerusid RAITTA Androidi rakenduse testijaks. Saatsid meile need andmed:',
    email: 'Google’i konto', name: 'Nimi', device: 'Telefon', city: 'Linn',
    nextTitle: 'Mis edasi',
    steps: [
      '1–2 päeva jooksul lisame sinu Google’i konto Google Play testi.',
      'Seejärel ava allolev link Android-telefonis sama Google’i kontoga ja puuduta „Hakka testijaks“.',
      'Paigalda RAITTA Google Playst ja hoia seda paigaldatuna vähemalt 14 päeva.',
    ],
    button: 'Liitu testiga Google Plays',
    feedback: 'Leidsid vea või on sul idee? Räägi meile aadressil raitta.fi/feedback või vasta sellele kirjale.',
    notYou: 'Sa ei registreerunud? Siis on keegi su aadressi kogemata sisestanud. Jäta kiri tähelepanuta või kirjuta privacy@raitta.fi ja me kustutame selle.',
    footer: 'RAITTA on iseseisev rakendus ega ole seotud ühegi transpordiasutusega.',
  },
};

const EXTRA = {
  en: { preheader: 'What you sent us, and how to join the test on Google Play.', feedbackLink: 'Feedback', privacyLink: 'Privacy', sent: 'What you sent' },
  fi: { preheader: 'Lähettämäsi tiedot ja ohjeet Google Playn testiin liittymiseen.', feedbackLink: 'Palaute', privacyLink: 'Tietosuoja', sent: 'Lähettämäsi tiedot' },
  sv: { preheader: 'Det du skickade och hur du går med i testet på Google Play.', feedbackLink: 'Respons', privacyLink: 'Integritet', sent: 'Det du skickade' },
  ru: { preheader: 'Что вы отправили и как присоединиться к тесту в Google Play.', feedbackLink: 'Отзывы', privacyLink: 'Конфиденциальность', sent: 'Ваша заявка' },
  et: { preheader: 'Mida sa saatsid ja kuidas Google Play testiga liituda.', feedbackLink: 'Tagasiside', privacyLink: 'Privaatsus', sent: 'Sinu andmed' },
};
const ICONS = ['📧', '👤', '📱', '📍'];
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const escapeHtml = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export function testerMail({ email, name, device, city, language, added }) {
  const base = TEXT[language] ?? TEXT.en;

  const t = added ? { ...base, steps: [ADDED_STEP[language] ?? ADDED_STEP.en, ...base.steps.slice(1)] } : base;
  const rows = [
    [t.email, email],
    [t.name, name],
    [t.device, device],
    [t.city, city],
  ].filter(([, value]) => value);

  const text = [
    t.hello(name),
    '',
    t.intro,
    ...rows.map(([label, value]) => `• ${label}: ${value}`),
    '',
    `${t.nextTitle}:`,
    ...t.steps.map((step, i) => `${i + 1}. ${step}`),
    '',
    `${t.button}: ${PLAY_LINK}`,
    '',
    t.feedback,
    '',
    t.notYou,
    '',
    '— RAITTA · raitta.fi',
  ].join('\n');

  const code = language in TEXT ? language : 'en';
  const x = EXTRA[code];
  const all = [
    [t.email, email, ICONS[0]],
    [t.name, name, ICONS[1]],
    [t.device, device, ICONS[2]],
    [t.city, city, ICONS[3]],
  ].filter(([, value]) => value);
  const html = `<!doctype html>
<html lang="${code}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(t.subject)}</title></head>
<body style="margin:0;padding:0;background:#e9eefb;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(x.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e9eefb;padding:28px 12px;font-family:${FONT};color:#0e1526;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:28px;overflow:hidden;box-shadow:0 24px 60px -30px rgba(8,20,60,0.45);">
<tr><td style="padding:0;background:#155eef;"><a href="https://raitta.fi" style="display:block;"><img src="https://raitta.fi/mail/tester-${code}.jpg" width="600" alt="${escapeHtml(t.subject)}" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></a></td></tr>
<tr><td style="padding:34px 32px 8px;font-size:16px;line-height:1.6;">
<p style="margin:0 0 10px;font-size:24px;line-height:1.25;font-weight:800;letter-spacing:-0.01em;">${escapeHtml(t.hello(name))}</p>
<p style="margin:0 0 24px;color:#3b4458;">${escapeHtml(t.intro)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5ff;border:1px solid #dfe7fb;border-radius:20px;">
<tr><td style="padding:18px 20px 6px;font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#155eef;">${escapeHtml(x.sent)}</td></tr>
${all.map(([label, value, icon]) => `<tr><td style="padding:8px 20px;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
<td width="40" style="width:40px;vertical-align:middle;"><div style="width:32px;height:32px;line-height:32px;text-align:center;border-radius:10px;background:#ffffff;font-size:16px;">${icon}</div></td>
<td style="vertical-align:middle;"><div style="font-size:12px;color:#6a7386;">${escapeHtml(label)}</div><div style="font-size:16px;font-weight:700;overflow-wrap:anywhere;">${label === t.email ? `<a href="mailto:${escapeHtml(value)}" style="color:#0e1526;text-decoration:none;">${escapeHtml(value).replace("@", "@<wbr>")}</a>` : escapeHtml(value)}</div></td>
</tr></table></td></tr>`).join('\n')}
<tr><td style="height:12px;line-height:12px;font-size:0;">&nbsp;</td></tr>
</table>
<p style="margin:32px 0 14px;font-size:20px;font-weight:800;letter-spacing:-0.01em;">${escapeHtml(t.nextTitle)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${t.steps.map((step, i) => `<tr><td width="44" style="width:44px;vertical-align:top;padding:0 0 16px;"><div style="width:32px;height:32px;line-height:32px;text-align:center;border-radius:50%;background:#155eef;color:#ffffff;font-weight:800;font-size:15px;">${i + 1}</div></td><td style="vertical-align:top;padding:4px 0 16px;color:#3b4458;">${escapeHtml(step)}</td></tr>`).join('\n')}
</table>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 30px;"><tr><td style="border-radius:999px;background:#ffc83d;box-shadow:0 10px 24px -12px rgba(255,170,0,0.8);">
<a href="${PLAY_LINK}" style="display:inline-block;padding:16px 28px;font-family:${FONT};font-size:16px;font-weight:800;color:#0e1526;text-decoration:none;border-radius:999px;">${escapeHtml(t.button)}&nbsp;&rarr;</a>
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0e1526;border-radius:20px;"><tr>
<td width="56" style="width:56px;padding:18px 0 18px 20px;vertical-align:middle;font-size:26px;">💬</td>
<td style="padding:18px 20px 18px 8px;vertical-align:middle;color:#ffffff;font-size:15px;line-height:1.5;">${escapeHtml(t.feedback)}</td>
</tr></table>
<p style="margin:22px 0 26px;color:#7a8396;font-size:13px;line-height:1.5;">${escapeHtml(t.notYou)}</p>
</td></tr>
<tr><td style="padding:24px 32px;background:#155eef;color:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-size:20px;font-weight:900;letter-spacing:0.08em;">RAITTA</td>
</tr>
<tr><td style="padding-top:12px;font-size:14px;"><a href="https://raitta.fi" style="color:#ffffff;text-decoration:none;font-weight:700;">raitta.fi</a> &nbsp;·&nbsp; <a href="https://raitta.fi/feedback" style="color:#ffffff;text-decoration:none;">${escapeHtml(x.feedbackLink)}</a> &nbsp;·&nbsp; <a href="https://raitta.fi/privacy" style="color:#ffffff;text-decoration:none;">${escapeHtml(x.privacyLink)}</a></td>
</tr>
<tr><td style="padding-top:10px;font-size:12px;line-height:1.5;color:rgba(255,255,255,0.75);">${escapeHtml(t.footer)}</td></tr>
</table>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject: t.subject, html, text };
}
