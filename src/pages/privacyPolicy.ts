export type PolicyLanguage = 'en' | 'fi';

interface PolicySection {
  id: string;
  title: string;
  paragraphs?: string[];
  items?: string[];
  
  table?: { head: [string, string, string, string]; rows: [string, string, string, string][] };
}

interface Policy {
  title: string;
  effective: string;
  summary: string[];
  sections: PolicySection[];
}

export const CONTROLLER = {
  name: 'Mark Chaikauskas',
  email: 'privacy@raitta.fi',
  general: 'online@raitta.fi',
  telegram: '@Raita_Robot',
};

export const PRIVACY_POLICY: Record<PolicyLanguage, Policy> = {
  en: {
    title: 'Privacy Policy',
    effective: 'Effective 8 November 2026',
    summary: [
      'No accounts, no advertising, no analytics, no tracking.',
      'Favourites, history and settings stay on your device.',
      'Location only with your permission. We keep it only in a road report you choose to send, for a few hours.',
      'You can delete everything in Settings with one tap.',
    ],
    sections: [
      {
        id: 'controller',
        title: '1. Controller',
        paragraphs: [
          `The controller under the EU General Data Protection Regulation (GDPR) is ${CONTROLLER.name}, a private person in Finland and the developer of the RAITTA app, website raitta.fi and Telegram bot ${CONTROLLER.telegram}.`,
          `Contact for all privacy matters: ${CONTROLLER.email}. Other questions and feedback: ${CONTROLLER.general} or raitta.fi/feedback. We answer within one month, as the GDPR requires.`,
          'RAITTA is independent and not affiliated with any transport authority or operator. No data protection officer has been appointed, as the law does not require one for this service.',
        ],
      },
      {
        id: 'scope',
        title: '2. What this policy covers',
        paragraphs: [
          'This policy covers the RAITTA web app (maps.raitta.fi), the website raitta.fi, the Android app, the Telegram Mini App and the Telegram bot. It explains what personal data is processed, why, on what legal basis, who receives it and for how long.',
          'The Android app’s permissions, notifications and data deletion are described in more detail in the Android App Privacy Policy at raitta.fi/privacy/android.',
        ],
      },
      {
        id: 'processing',
        title: '3. What we process and why',
        paragraphs: [
          'RAITTA is built to need as little personal data as possible. We keep no user database. The table lists every kind of processing.',
        ],
        table: {
          head: ['Purpose', 'Data', 'Legal basis', 'Kept for'],
          rows: [
            ['Delivering the app and website, keeping them secure', 'IP address, device and browser type, time and address of each request', 'Legitimate interest in running a working and secure service, GDPR Art. 6(1)(f)', 'Short-term server logs of our host Vercel, then deleted'],
            ['Showing where you are, nearby stops and departures', 'Precise location, on your device', 'Your consent, given in the device’s permission prompt, Art. 6(1)(a)', 'Not stored by us; only while the app is open'],
            ['Walking and car routes, search, nearby places of a kind or chain', 'Coordinates of a start point or of the map area you search in, search text', 'Your request: you asked for the feature, Art. 6(1)(f)', 'Not stored by us; see the recipients below'],
            ['Speed limits and speed cameras while you drive', 'The shape of the car route, not your position; cameras are compared on your phone', 'Your request: you started driving, Art. 6(1)(f)', 'Not stored'],
            ['Your settings, favourites and recent places', 'Stored only in your browser or app storage', 'Necessary for the service you asked for (Act 917/2014, s. 205)', 'Until you delete them in Settings or remove the app'],
            ['Fuel price reports', 'Price, station and time; no name, location or IP address', 'Legitimate interest in sharing prices with riders, Art. 6(1)(f)', 'Until a newer report for the same station replaces it'],
            ['Road reports (speed camera, police, accident, hazard), if you send one, and your “still there / gone” answers', 'Kind of report, the point on the road and the time. No name or device ID; the IP address is only counted in the server’s memory for a few minutes to stop floods, and not stored', 'Legitimate interest in warning other drivers, Art. 6(1)(f)', '2–4 hours after the last driver confirmed it, sooner if drivers say it is gone'],
            ['Answering you in the Telegram bot', 'Your message, chat ID and Telegram language', 'Legitimate interest in answering your request, Art. 6(1)(f)', 'Not stored by us; handled and forgotten at once'],
            ['Feedback and suggestions sent from the website', 'Your message and topic; your name and email only if you give them', 'Legitimate interest in answering you and improving RAITTA, Art. 6(1)(f)', 'Up to 12 months, then deleted'],
            ['Inviting you to test the Android app, if you sign up at raitta.fi/testers', 'Your Google account email; your name, phone model and city only if you give them', 'Your consent, given with the checkbox, Art. 6(1)(a)', 'Until the test ends or you withdraw, then deleted; the email also stays in the Google Play tester list until removed'],
            ['Answering privacy requests', 'Your email address and message', 'Legal obligation to answer, Art. 6(1)(c)', 'Up to 12 months after the matter is closed'],
          ],
        },
      },
      {
        id: 'device',
        title: '4. Storage on your device',
        paragraphs: [
          'RAITTA uses no cookies. It keeps your language, theme, city, map layers, walking speed, favourite stops, lines and places, recent places, driving voice and whether you allowed location in your browser’s local storage or the app’s storage. Timetables and map tiles are cached so the app works offline.',
          'This storage is strictly necessary for the service you ask for, so under section 205 of the Finnish Act on Electronic Communications Services it needs no separate consent. Nothing of it is sent to us. Settings → Privacy lets you turn off search history or delete all of it.',
        ],
      },
      {
        id: 'location',
        title: '5. Location',
        paragraphs: [
          'Location is used only after you allow it in the permission prompt of your device, browser or Telegram. You can withdraw that permission at any time in the same place; withdrawing does not affect processing that already took place.',
          'Your location leaves the device only when a feature needs it: as the start of a walking or car route, while driving when a new route is needed, as the point of a road report you choose to send, to find nearby fuel stations, and indirectly through the map area you view or search in. Without location the app still works: you choose a city and places by hand. In Settings you can also tell RAITTA never to use your location; it then asks before every exception.',
        ],
      },
      {
        id: 'recipients',
        title: '6. Who receives data',
        paragraphs: [
          'To work, the app connects to the services below. Each receives your IP address as part of the connection and processes data under its own privacy policy. We never send them your name or any account details, and we do not sell or share data for marketing.',
        ],
        items: [
          'Vercel Inc. (USA): hosting of the app, website, timetables, fuel price and road reports and server functions. Acts as our processor.',
          'OpenFreeMap: map tiles; sees which map areas are loaded.',
          'Photon by komoot GmbH (Germany): place, kind-of-place and chain search; receives what you type and the centre of the map area searched in.',
          'FOSSGIS e.V., routing.openstreetmap.de (Germany): walking routes; receives the start and end points.',
          'RAITTA’s own routing server, route.raitta.fi (rented server in Sweden): car routes, turn-by-turn driving and speed limits; receives the start and end points of a car route, the route’s shape to look up its speed limits and, while you drive, your position each time a new route is needed. Routes are not stored; the server’s logs keep IP addresses for 14 days.',
          'OpenStreetMap Foundation: the phone, website and opening hours of a fuel station or of a place you open on the map. Our server asks on your behalf, so it does not see your device.',
          'A place’s own website: when you open a place that has one, our server reads the preview the site offers for shared links (title, a short description, an image). The site sees our server, not your device.',
          'Digitransit, HSL and ITS Factory (Finland): live vehicle positions; Digitransit and HSL receive the rough map area you view.',
          'Fintraffic Digitraffic (Finland): train times, and in trains mode the live positions of long-distance trains and the departures from a station; it receives the stations, trains and times you look up, never your location. EV chargers, their prices and road events also come from Fintraffic, through our server, so Fintraffic does not see your device.',
          'Wikimedia Foundation (USA): the city photos in the city list and, when you open a place card, its photo, Wikipedia’s description and Wikidata. Sight icons and chain logos are part of RAITTA’s own files, so showing them on the map contacts no one else.',
          'Resend Inc. (USA, sending from the EU): if you sign up as a tester, the confirmation email with what you sent. Acts as our processor.',
          'Telegram: if you use the Mini App or the bot, Telegram’s own policy applies. RAITTA does not read your Telegram profile. Feedback from the website is delivered to the developer through Telegram.',
          'Ticket apps, app stores and other sites open only when you tap a link to them, and their own policies apply there.',
        ],
      },
      {
        id: 'transfers',
        title: '7. Transfers outside the EU',
        paragraphs: [
          'Vercel, Resend and the Wikimedia Foundation are based in the United States, and Telegram operates worldwide. Transfers to the United States rely on the European Commission’s adequacy decision for the EU–US Data Privacy Framework where the recipient is certified, and otherwise on the Commission’s standard contractual clauses (GDPR Art. 45–46). You can ask us for a copy of the safeguards.',
        ],
      },
      {
        id: 'rights',
        title: '8. Your rights',
        paragraphs: ['Under the GDPR you have the right to:'],
        items: [
          'know whether we process your data and get a copy of it (Art. 15);',
          'have incorrect data corrected (Art. 16) and data erased (Art. 17);',
          'restrict processing (Art. 18) and receive your data in a portable format (Art. 20);',
          'object to processing based on legitimate interest (Art. 21);',
          'withdraw consent at any time, for example by turning location off;',
          'lodge a complaint with the Finnish Data Protection Ombudsman: tietosuoja.fi, tietosuoja@om.fi, PL 800, 00531 Helsinki.',
        ],
      },
      {
        id: 'more',
        title: '9. Other things you should know',
        items: [
          'You are not required to give any personal data. Without location, some features need you to choose places by hand.',
          'RAITTA makes no automated decisions or profiling that affect you (Art. 22).',
          'RAITTA is meant for everyone. In Finland, children under 13 need a guardian’s consent for consent-based processing (Data Protection Act, s. 5); the only such processing is location.',
          'Connections are encrypted (HTTPS). Server access is limited to the developer.',
        ],
      },
      {
        id: 'changes',
        title: '10. Changes',
        paragraphs: ['If this policy changes, the new version appears here with a new date.'],
      },
      {
        id: 'sources',
        title: 'Data sources',
        items: [
          'Transport data: ITS Factory, HSL, Föli, Waltti and Digitransit.',
          'Map: OpenFreeMap, OpenMapTiles and OpenStreetMap contributors.',
          'Place and fuel station search: Photon, using OpenStreetMap data.',
          'Places, opening hours, speed cameras and speed limits: OpenStreetMap contributors, ODbL. Sights: Wikidata (CC0), photos from Wikimedia Commons with each author and licence shown, descriptions from Wikipedia (CC BY-SA).',
          'Chain logos: trademarks of their owners, from Wikimedia Commons, shown only to identify the chain. Police, accident and hazard reports: RAITTA’s drivers.',
          'Trains, EV chargers and road events: Fintraffic Digitraffic, CC BY 4.0. Rail lines on the map and roads for car routes: OpenStreetMap contributors, ODbL; routes by Valhalla.',
          'Average fuel prices: fuel-prices.eu, EU Oil Bulletin, CC BY 4.0.',
        ],
      },
    ],
  },
  fi: {
    title: 'Tietosuojaseloste',
    effective: 'Voimassa 8.11.2026 alkaen',
    summary: [
      'Ei käyttäjätilejä, mainontaa, analytiikkaa eikä seurantaa.',
      'Suosikit, historia ja asetukset pysyvät laitteellasi.',
      'Sijainti vain luvallasi. Säilytämme sen vain lähettämässäsi tieilmoituksessa muutaman tunnin ajan.',
      'Voit poistaa kaiken asetuksista yhdellä napautuksella.',
    ],
    sections: [
      {
        id: 'controller',
        title: '1. Rekisterinpitäjä',
        paragraphs: [
          `EU:n yleisen tietosuoja-asetuksen (GDPR) mukainen rekisterinpitäjä on ${CONTROLLER.name}, yksityishenkilö Suomessa ja RAITTA-sovelluksen, raitta.fi-sivuston ja Telegram-botin ${CONTROLLER.telegram} kehittäjä.`,
          `Yhteystiedot kaikissa tietosuoja-asioissa: ${CONTROLLER.email}. Muut kysymykset ja palaute: ${CONTROLLER.general} tai raitta.fi/feedback. Vastaamme kuukauden kuluessa, kuten tietosuoja-asetus edellyttää.`,
          'RAITTA on itsenäinen eikä liity mihinkään liikenneviranomaiseen tai liikennöitsijään. Tietosuojavastaavaa ei ole nimetty, koska laki ei edellytä sitä tältä palvelulta.',
        ],
      },
      {
        id: 'scope',
        title: '2. Mitä tämä seloste koskee',
        paragraphs: [
          'Seloste koskee RAITTA-verkkosovellusta (maps.raitta.fi), raitta.fi-sivustoa, Android-sovellusta, Telegram-miniohjelmaa ja Telegram-bottia. Siinä kerrotaan, mitä henkilötietoja käsitellään, miksi, millä perusteella, kenelle niitä luovutetaan ja kuinka kauan niitä säilytetään.',
          'Android-sovelluksen käyttöoikeudet, ilmoitukset ja tietojen poistaminen kerrotaan tarkemmin Android-sovelluksen tietosuojaselosteessa osoitteessa raitta.fi/privacy/android.',
        ],
      },
      {
        id: 'processing',
        title: '3. Mitä käsittelemme ja miksi',
        paragraphs: ['RAITTA on tehty tarvitsemaan mahdollisimman vähän henkilötietoja. Meillä ei ole käyttäjärekisteriä. Taulukossa on kaikki käsittely.'],
        table: {
          head: ['Tarkoitus', 'Tiedot', 'Oikeusperuste', 'Säilytys'],
          rows: [
            ['Sovelluksen ja sivuston toimittaminen ja suojaaminen', 'IP-osoite, laite- ja selaintyyppi, pyynnön aika ja osoite', 'Oikeutettu etu toimivan ja turvallisen palvelun ylläpitoon, GDPR 6(1)(f)', 'Palveluntarjoajamme Vercelin lyhytaikaiset palvelinlokit, sitten poisto'],
            ['Oman sijainnin, lähipysäkkien ja lähtöjen näyttäminen', 'Tarkka sijainti, laitteellasi', 'Suostumuksesi laitteen lupakyselyssä, 6(1)(a)', 'Emme tallenna; vain sovelluksen ollessa auki'],
            ['Kävely- ja autoreitit, haku, lähimmät tietyn tyypin tai ketjun paikat', 'Lähtöpisteen tai haetun kartta-alueen koordinaatit, hakuteksti', 'Pyyntösi: valitsit toiminnon, 6(1)(f)', 'Emme tallenna; ks. vastaanottajat alla'],
            ['Nopeusrajoitukset ja nopeusvalvontakamerat ajon aikana', 'Autoreitin muoto, ei sijaintiasi; kameroita verrataan puhelimessasi', 'Pyyntösi: aloitit ajon, 6(1)(f)', 'Ei tallenneta'],
            ['Asetuksesi, suosikkisi ja viimeisimmät paikat', 'Vain selaimesi tai sovelluksen tallennustilassa', 'Välttämätön pyytämäsi palvelun kannalta (laki 917/2014, 205 §)', 'Kunnes poistat ne asetuksista tai poistat sovelluksen'],
            ['Polttoainehintojen ilmoitukset', 'Hinta, asema ja aika; ei nimeä, sijaintia eikä IP-osoitetta', 'Oikeutettu etu jakaa hintoja matkustajille, 6(1)(f)', 'Kunnes saman aseman uudempi ilmoitus korvaa sen'],
            ['Tieilmoitukset (nopeusvalvonta, poliisi, onnettomuus, vaara), jos lähetät sellaisen, ja vastauksesi ”yhä paikalla / poissa”', 'Ilmoituksen tyyppi, kohta tiellä ja aika. Ei nimeä eikä laitetunnusta; IP-osoitetta lasketaan vain palvelimen muistissa muutaman minuutin ajan tulvien estämiseksi, eikä sitä tallenneta', 'Oikeutettu etu varoittaa muita kuljettajia, 6(1)(f)', '2–4 tuntia viimeisimmästä vahvistuksesta, aiemmin jos kuljettajat ilmoittavat sen poistuneen'],
            ['Vastaaminen Telegram-botissa', 'Viestisi, keskustelun tunniste ja Telegramin kieli', 'Oikeutettu etu vastata pyyntöösi, 6(1)(f)', 'Emme tallenna; käsitellään ja unohdetaan heti'],
            ['Sivuston kautta lähetetty palaute ja ehdotukset', 'Viestisi ja aihe; nimesi ja sähköpostisi vain, jos annat ne', 'Oikeutettu etu vastata sinulle ja kehittää RAITTAa, 6(1)(f)', 'Enintään 12 kuukautta, sitten poisto'],
            ['Kutsu Android-sovelluksen testiin, jos ilmoittaudut osoitteessa raitta.fi/testers', 'Google-tilisi sähköposti; nimi, puhelinmalli ja kaupunki vain, jos annat ne', 'Suostumuksesi, jonka annat valintaruudulla, 6(1)(a)', 'Kunnes testi päättyy tai perut suostumuksen, sitten poistetaan; sähköposti on myös Google Playn testaajalistassa, kunnes se poistetaan'],
            ['Tietosuojapyyntöihin vastaaminen', 'Sähköpostiosoitteesi ja viestisi', 'Lakisääteinen velvoite vastata, 6(1)(c)', 'Enintään 12 kuukautta asian päättymisestä'],
          ],
        },
      },
      {
        id: 'device',
        title: '4. Tallennus laitteellesi',
        paragraphs: [
          'RAITTA ei käytä evästeitä. Se tallentaa kielen, teeman, kaupungin, kartan tasot, kävelynopeuden, suosikkipysäkit, -linjat ja -paikat, viimeisimmät paikat, ajo-opastuksen äänen sekä tiedon antamastasi sijaintiluvasta selaimen paikalliseen tallennustilaan tai sovelluksen tallennustilaan. Aikataulut ja karttatiedot välimuistitetaan, jotta sovellus toimii ilman verkkoyhteyttä.',
          'Tallennus on välttämätöntä pyytämäsi palvelun tarjoamiseksi, joten sähköisen viestinnän palveluista annetun lain 205 §:n mukaan siihen ei tarvita erillistä suostumusta. Mitään siitä ei lähetetä meille. Asetukset → Tietosuoja -kohdassa voit poistaa hakuhistorian käytöstä tai poistaa kaikki tiedot.',
        ],
      },
      {
        id: 'location',
        title: '5. Sijainti',
        paragraphs: [
          'Sijaintia käytetään vasta, kun olet sallinut sen laitteesi, selaimesi tai Telegramin lupakyselyssä. Voit perua luvan milloin tahansa samasta paikasta; peruminen ei vaikuta jo tapahtuneeseen käsittelyyn.',
          'Sijaintisi lähtee laitteelta vain, kun toiminto tarvitsee sitä: kävely- tai autoreitin lähtöpisteenä, ajon aikana uutta reittiä haettaessa, lähettämäsi tieilmoituksen kohtana, lähimpien huoltoasemien hakuun ja epäsuorasti katselemasi tai hakemasi kartta-alueen kautta. Ilman sijaintia sovellus toimii silti: valitset kaupungin ja paikat itse. Asetuksissa voit myös kieltää sijainnin käytön kokonaan; silloin RAITTA kysyy ennen jokaista poikkeusta.',
        ],
      },
      {
        id: 'recipients',
        title: '6. Tietojen vastaanottajat',
        paragraphs: [
          'Toimiakseen sovellus ottaa yhteyttä alla oleviin palveluihin. Jokainen saa IP-osoitteesi osana yhteyttä ja käsittelee tietoja oman tietosuojakäytäntönsä mukaisesti. Emme koskaan lähetä niille nimeäsi tai tilitietoja, emmekä myy tai luovuta tietoja markkinointiin.',
        ],
        items: [
          'Vercel Inc. (Yhdysvallat): sovelluksen, sivuston, aikataulujen, hinta- ja tieilmoitusten sekä palvelintoimintojen ylläpito. Toimii henkilötietojen käsittelijänämme.',
          'OpenFreeMap: karttatiedot; näkee, mitä kartta-alueita ladataan.',
          'Photon, komoot GmbH (Saksa): paikka-, paikkatyyppi- ja ketjuhaku; saa kirjoittamasi tekstin ja haetun kartta-alueen keskipisteen.',
          'FOSSGIS e.V., routing.openstreetmap.de (Saksa): kävelyreitit; saa reitin alku- ja loppupisteen.',
          'RAITTAn oma reitityspalvelin, route.raitta.fi (vuokrapalvelin Ruotsissa): autoreitit, ajo-opastus ja nopeusrajoitukset; saa autoreitin alku- ja loppupisteen, reitin muodon nopeusrajoitusten hakemiseksi sekä ajon aikana sijaintisi aina, kun tarvitaan uusi reitti. Reittejä ei tallenneta; palvelimen lokit säilyttävät IP-osoitteet 14 päivää.',
          'OpenStreetMap Foundation: huoltoaseman tai kartalta avaamasi paikan puhelin, verkkosivu ja aukioloajat. Palvelimemme hakee ne puolestasi, joten se ei näe laitettasi.',
          'Paikan oma verkkosivusto: kun avaat paikan, jolla on sivusto, palvelimemme lukee sivuston linkkien jakamista varten tarjoaman esikatselun (otsikko, lyhyt kuvaus, kuva). Sivusto näkee palvelimemme, ei laitettasi.',
          'Digitransit, HSL ja ITS Factory (Suomi): ajoneuvojen sijainnit; Digitransit ja HSL saavat karkean tiedon katselemastasi kartta-alueesta.',
          'Fintraffic Digitraffic (Suomi): junien aikataulut sekä junatilassa kaukojunien sijainnit ja asemien lähdöt; saa katsomasi asemat, junat ja ajat, ei koskaan sijaintiasi. Myös latauspisteet, niiden hinnat ja liikennetiedotteet tulevat Fintrafficilta palvelimemme kautta, joten Fintraffic ei näe laitettasi.',
          'Wikimedia Foundation (Yhdysvallat): kaupunkilistan kuvat sekä paikkakorttia avatessasi sen kuva, Wikipedian kuvaus ja Wikidata. Nähtävyyksien kuvakkeet ja ketjujen logot ovat RAITTAn omia tiedostoja, joten niiden näyttäminen kartalla ei ota yhteyttä muualle.',
          'Resend Inc. (Yhdysvallat, lähetys EU:sta): jos ilmoittaudut testaajaksi, vahvistusviesti lähettämistäsi tiedoista. Toimii henkilötietojen käsittelijänämme.',
          'Telegram: jos käytät miniohjelmaa tai bottia, Telegramin oma käytäntö on voimassa. RAITTA ei lue Telegram-profiiliasi. Sivuston kautta lähetetty palaute toimitetaan kehittäjälle Telegramin kautta.',
          'Lippusovellukset, sovelluskaupat ja muut sivustot avautuvat vain, kun napautat niiden linkkiä, ja niissä noudatetaan niiden omia käytäntöjä.',
        ],
      },
      {
        id: 'transfers',
        title: '7. Siirrot EU:n ulkopuolelle',
        paragraphs: [
          'Vercel, Resend ja Wikimedia Foundation toimivat Yhdysvalloissa, ja Telegram toimii maailmanlaajuisesti. Siirrot Yhdysvaltoihin perustuvat Euroopan komission tietosuojakehystä (EU–US Data Privacy Framework) koskevaan riittävyyspäätökseen, kun vastaanottaja on sertifioitu, ja muuten komission vakiosopimuslausekkeisiin (GDPR 45–46 art.). Voit pyytää meiltä kopion suojatoimista.',
        ],
      },
      {
        id: 'rights',
        title: '8. Oikeutesi',
        paragraphs: ['Tietosuoja-asetuksen mukaan sinulla on oikeus:'],
        items: [
          'tietää, käsittelemmekö tietojasi, ja saada niistä kopio (15 art.);',
          'oikaista virheelliset tiedot (16 art.) ja saada tiedot poistetuksi (17 art.);',
          'rajoittaa käsittelyä (18 art.) ja siirtää tiedot järjestelmästä toiseen (20 art.);',
          'vastustaa oikeutettuun etuun perustuvaa käsittelyä (21 art.);',
          'perua suostumuksesi milloin tahansa, esimerkiksi poistamalla sijainnin käytöstä;',
          'tehdä valitus tietosuojavaltuutetun toimistolle: tietosuoja.fi, tietosuoja@om.fi, PL 800, 00531 Helsinki.',
        ],
      },
      {
        id: 'more',
        title: '9. Muuta tärkeää',
        items: [
          'Sinun ei ole pakko antaa henkilötietoja. Ilman sijaintia osa toiminnoista edellyttää, että valitset paikat itse.',
          'RAITTA ei tee sinua koskevia automaattisia päätöksiä eikä profilointia (22 art.).',
          'RAITTA on tarkoitettu kaikille. Suomessa alle 13-vuotiaan suostumukseen perustuva käsittely edellyttää huoltajan suostumusta (tietosuojalaki 5 §); ainoa tällainen käsittely on sijainti.',
          'Yhteydet ovat salattuja (HTTPS). Pääsy palvelimiin on vain kehittäjällä.',
        ],
      },
      {
        id: 'changes',
        title: '10. Muutokset',
        paragraphs: ['Jos seloste muuttuu, uusi versio julkaistaan tässä uudella päivämäärällä.'],
      },
      {
        id: 'sources',
        title: 'Tietolähteet',
        items: [
          'Liikennetiedot: ITS Factory, HSL, Föli, Waltti ja Digitransit.',
          'Kartta: OpenFreeMap, OpenMapTiles ja OpenStreetMapin tekijät.',
          'Paikka- ja huoltoasemahaku: Photon, OpenStreetMap-aineisto.',
          'Paikat, aukioloajat, nopeusvalvontakamerat ja nopeusrajoitukset: OpenStreetMapin tekijät, ODbL. Nähtävyydet: Wikidata (CC0), kuvat Wikimedia Commonsista tekijöineen ja lisensseineen, kuvaukset Wikipediasta (CC BY-SA).',
          'Ketjujen logot: omistajiensa tavaramerkkejä, Wikimedia Commonsista, näytetään vain ketjun tunnistamiseksi. Poliisi-, onnettomuus- ja vaarailmoitukset: RAITTAn kuljettajat.',
          'Junat, latauspisteet ja liikennetiedotteet: Fintraffic Digitraffic, CC BY 4.0. Ratalinjat kartalla ja autoreittien tiet: OpenStreetMapin tekijät, ODbL; reitit Valhalla.',
          'Polttoaineiden keskihinnat: fuel-prices.eu, EU Oil Bulletin, CC BY 4.0.',
        ],
      },
    ],
  },
};

export const ANDROID_PRIVACY_POLICY: Record<PolicyLanguage, Policy> = {
  en: {
    title: 'Android App Privacy Policy',
    effective: 'Effective 8 November 2026 · RAITTA for Android (com.raitta.fi)',
    summary: [
      'No account, no ads, no analytics or tracking SDKs.',
      'Location only while you use the app, never in the background.',
      'Trip reminders are created on your phone, not sent by a server.',
      'Uninstalling or clearing the app’s data deletes everything.',
    ],
    sections: [
      {
        id: 'about',
        title: '1. About this policy',
        paragraphs: [
          `This policy covers the RAITTA app for Android (package name com.raitta.fi), downloaded from Google Play or from raitta.fi. The developer and controller is ${CONTROLLER.name}, a private person in Finland. Contact: ${CONTROLLER.email}.`,
          'It adds Android details to the general RAITTA Privacy Policy at raitta.fi/privacy, which also applies to the app and describes your rights under the GDPR, transfers outside the EU and how to complain. If the two differ, this policy applies to the Android app.',
        ],
      },
      {
        id: 'permissions',
        title: '2. Permissions the app asks for',
        paragraphs: [
          'Android shows a prompt for the permissions that need your consent. You can refuse them or turn them off later in Android Settings → Apps → RAITTA → Permissions; the app keeps working without them.',
        ],
        table: {
          head: ['Permission', 'What it is for', 'When it is used', 'If you refuse'],
          rows: [
            ['Precise and approximate location', 'Showing where you are, nearby stops, your city and the walk to the stop; following you during a trip', 'Only while the app is open on screen. RAITTA does not ask for background location', 'You choose the city and places by hand'],
            ['Notifications', 'Trip reminders: when to leave for the stop and when to get off', 'Only after you start a trip and allow reminders', 'No reminders; the trip screen still shows each step'],
            ['Alarms and reminders (exact alarms)', 'Showing a trip reminder at the right minute', 'Only for a trip you started', 'Reminders may come a few minutes late'],
            ['Run at startup', 'Keeping trip reminders you already set after the phone restarts', 'After a restart, only if a reminder is still due', 'Not asked; it has no prompt and carries no data'],
            ['Internet and network state', 'Loading timetables, live vehicles and maps; noticing when you are offline', 'While the app is open', 'Not asked; the app needs the internet to work'],
            ['Keep awake (wake lock)', 'Letting a due reminder be shown while the phone sleeps', 'Briefly, when a reminder is shown', 'Not asked; it carries no data'],
          ],
        },
      },
      {
        id: 'data',
        title: '3. Data the app handles',
        table: {
          head: ['Data', 'Why', 'Where it goes', 'Kept for'],
          rows: [
            ['Location', 'The features in section 2', 'Processed on the phone by Android and Google Play services. Leaves the phone only as the start of a walking or car route, while driving when a new route is needed, as the point of a road report you choose to send, the search point for nearby places, and the map area you view', 'Not stored by RAITTA, except a road report you send (see below); only while the app is open'],
            ['Settings, favourites, recent places, last city', 'Remembering your choices', 'Only in the app’s storage on your phone', 'Until you delete them or the app'],
            ['Timetables and map tiles', 'Working quickly and offline', 'Cached on your phone; contain no personal data', 'Replaced when newer data is loaded'],
            ['Trip reminders', 'Reminding you during a trip', 'Created and scheduled on the phone with Android’s alarm system. No push service and no server is involved', 'Until shown, or until you end the trip'],
            ['Search text', 'Finding places', 'Sent to the Photon place search', 'Not stored by RAITTA'],
            ['Fuel price reports, if you send one', 'Sharing prices with other drivers', 'RAITTA’s server; no name, location or IP address is kept', 'Until a newer report replaces it'],
            ['Road reports (speed camera, police, accident, hazard), if you send one, and your “still there / gone” answers', 'Warning other drivers', 'RAITTA’s server: kind, point on the road and time; no name, device ID or IP address is kept', '2–4 hours after the last confirmation, sooner if drivers say it is gone'],
            ['Favourite places', 'Showing them on the map and in Favourites', 'Only in the app’s storage on your phone', 'Until you remove them or the app'],
            ['IP address and request details', 'Delivering data and keeping the service secure', 'Every service the app connects to, see section 4', 'Short-term server logs'],
          ],
        },
      },
      {
        id: 'connections',
        title: '4. Services the app connects to',
        paragraphs: [
          'The app has no advertising, analytics, crash-reporting, attribution or social-media SDKs, and does not use Firebase or any push service. It connects only to the services below, each of which processes the connection under its own policy:',
        ],
        items: [
          'raitta.fi, hosted by Vercel Inc.: timetables, city data, fuel price and road reports, place details and the app’s server functions.',
          'Google Play services on your phone: Android’s location provider, which the app uses to read your location. Google’s privacy policy applies to it.',
          'OpenFreeMap: map tiles. Photon by komoot: place and fuel station search. FOSSGIS routing.openstreetmap.de: walking routes. RAITTA’s routing server route.raitta.fi (Sweden): car routes, driving directions and speed limits, from the start and end points, the route’s shape and, while driving, your position when a new route is needed; not stored.',
          'Digitransit, HSL and ITS Factory: live vehicle positions. Fintraffic Digitraffic: train times, live long-distance trains and station departures; EV chargers and road events through our server. Wikimedia: city photos, and a place’s photo, Wikipedia description and Wikidata when you open its card.',
          'VR Matkalla, VR’s ticket app, or its website opens only when you tap the ticket button in trains mode.',
          'Ticket apps and websites open only when you tap a ticket link, and their own policies apply there.',
          'The copy downloaded from raitta.fi also checks raitta.fi/app-version.json when it starts, to tell you when an update is needed. That request carries no personal data. The Google Play copy does not do this, as Google Play updates it.',
        ],
      },
      {
        id: 'play',
        title: '5. Google Play',
        paragraphs: [
          'When you install the app from Google Play, Google processes your account and download under its own terms and privacy policy. If you have allowed it in Android, Google may collect crash and performance reports. The developer sees only the summarised statistics Google Play Console shows, such as install counts and crash rates, and never who you are.',
        ],
      },
      {
        id: 'safety',
        title: '6. Data safety summary',
        items: [
          'Data collected: location (precise and approximate), used for app functionality, processed only while you use the app and not required. It is not stored, except the point of a road report you choose to send, which other drivers see for a few hours with no identifier attached.',
          'Data shared with third parties for their own purposes: none. Data is sent to the services in section 4 only to perform what you asked for.',
          'Data sold or used for advertising or tracking: none.',
          'Data encrypted in transit: yes, all connections use HTTPS.',
          'No account is needed, so there is no account to delete.',
        ],
      },
      {
        id: 'delete',
        title: '7. Deleting your data',
        paragraphs: ['Everything the app keeps is on your phone, so you can delete it yourself at any time:'],
        items: [
          'in the app: Settings → Privacy → Delete all my data;',
          'in Android: Settings → Apps → RAITTA → Storage → Clear storage;',
          'by uninstalling the app, which removes all of its data from the phone;',
          `road reports delete themselves 2–4 hours after the last confirmation;`,
          `for a fuel price report or anything else held on the server, write to ${CONTROLLER.email} and it is deleted within one month.`,
        ],
      },
      {
        id: 'children',
        title: '8. Children',
        paragraphs: [
          'RAITTA is a general timetable app for everyone and is not directed at children. It collects no data that identifies a child. In Finland, children under 13 need a guardian’s consent for location, the only processing based on consent.',
        ],
      },
      {
        id: 'contact',
        title: '9. Changes and contact',
        paragraphs: [
          'If this policy changes, the new version appears at raitta.fi/privacy/android with a new date, and significant changes are mentioned in the app’s release notes.',
          `Privacy questions and requests: ${CONTROLLER.email}. Other questions: ${CONTROLLER.general} or raitta.fi/feedback. You may also complain to the Finnish Data Protection Ombudsman, tietosuoja.fi.`,
        ],
      },
    ],
  },
  fi: {
    title: 'Android-sovelluksen tietosuojaseloste',
    effective: 'Voimassa 8.11.2026 alkaen · RAITTA Androidille (com.raitta.fi)',
    summary: [
      'Ei tiliä, ei mainoksia, ei analytiikka- tai seurantakirjastoja.',
      'Sijainti vain sovellusta käytettäessä, ei koskaan taustalla.',
      'Matkamuistutukset luodaan puhelimessa, ei palvelimella.',
      'Sovelluksen poistaminen tai sen tietojen tyhjentäminen poistaa kaiken.',
    ],
    sections: [
      {
        id: 'about',
        title: '1. Tästä selosteesta',
        paragraphs: [
          `Tämä seloste koskee RAITTA-sovellusta Androidille (paketin nimi com.raitta.fi), joka on ladattu Google Playsta tai osoitteesta raitta.fi. Kehittäjä ja rekisterinpitäjä on ${CONTROLLER.name}, yksityishenkilö Suomessa. Yhteystieto: ${CONTROLLER.email}.`,
          'Se täydentää RAITTAn yleistä tietosuojaselostetta osoitteessa raitta.fi/privacy Androidia koskevilla tiedoilla. Yleinen seloste koskee myös sovellusta ja kertoo oikeuksistasi GDPR:n mukaan, siirroista EU:n ulkopuolelle ja valituksen tekemisestä. Jos selosteet eroavat, Android-sovellukseen sovelletaan tätä selostetta.',
        ],
      },
      {
        id: 'permissions',
        title: '2. Sovelluksen pyytämät käyttöoikeudet',
        paragraphs: [
          'Android kysyy suostumustasi niihin käyttöoikeuksiin, jotka sitä vaativat. Voit kieltäytyä tai poistaa ne myöhemmin kohdassa Androidin asetukset → Sovellukset → RAITTA → Käyttöoikeudet; sovellus toimii ilman niitäkin.',
        ],
        table: {
          head: ['Käyttöoikeus', 'Mihin sitä käytetään', 'Milloin', 'Jos kieltäydyt'],
          rows: [
            ['Tarkka ja likimääräinen sijainti', 'Sijaintisi, lähipysäkit, kaupunkisi ja kävelymatka pysäkille näytetään; matkan aikana kartta seuraa sinua', 'Vain kun sovellus on auki näytöllä. RAITTA ei pyydä sijaintia taustalla', 'Valitset kaupungin ja paikat itse'],
            ['Ilmoitukset', 'Matkamuistutukset: milloin lähteä pysäkille ja milloin jäädä pois', 'Vain kun aloitat matkan ja sallit muistutukset', 'Ei muistutuksia; matkanäkymä näyttää silti jokaisen vaiheen'],
            ['Hälytykset ja muistutukset (tarkat hälytykset)', 'Matkamuistutus näytetään oikealla minuutilla', 'Vain aloittamallesi matkalle', 'Muistutukset voivat tulla muutaman minuutin myöhässä'],
            ['Käynnistys laitteen käynnistyessä', 'Jo asetetut matkamuistutukset säilyvät puhelimen uudelleenkäynnistyksessä', 'Uudelleenkäynnistyksen jälkeen, vain jos muistutus on vielä tulossa', 'Ei kysytä; ei sisällä tietoja'],
            ['Internet ja verkon tila', 'Aikataulut, ajoneuvot ja kartat ladataan; sovellus huomaa, kun yhteyttä ei ole', 'Kun sovellus on auki', 'Ei kysytä; sovellus tarvitsee internetin'],
            ['Hereillä pito (wake lock)', 'Muistutus voidaan näyttää puhelimen ollessa lepotilassa', 'Hetken, kun muistutus näytetään', 'Ei kysytä; ei sisällä tietoja'],
          ],
        },
      },
      {
        id: 'data',
        title: '3. Sovelluksen käsittelemät tiedot',
        table: {
          head: ['Tieto', 'Miksi', 'Minne se menee', 'Säilytysaika'],
          rows: [
            ['Sijainti', 'Kohdan 2 toiminnot', 'Käsitellään puhelimessa Androidin ja Google Play -palveluiden avulla. Lähtee puhelimesta vain kävely- tai autoreitin lähtöpisteenä, ajon aikana uutta reittiä haettaessa, lähettämäsi tieilmoituksen kohtana, lähimpien paikkojen hakupisteenä ja katsomasi kartta-alueen kautta', 'RAITTA ei tallenna, paitsi lähettämäsi tieilmoituksen (ks. alla); vain sovelluksen ollessa auki'],
            ['Asetukset, suosikit, viimeisimmät paikat, viimeisin kaupunki', 'Valintojesi muistaminen', 'Vain sovelluksen tallennustilassa puhelimessasi', 'Kunnes poistat ne tai sovelluksen'],
            ['Aikataulut ja karttapalat', 'Nopea toiminta ja käyttö ilman yhteyttä', 'Välimuistissa puhelimessa; eivät sisällä henkilötietoja', 'Korvataan uudemmilla tiedoilla'],
            ['Matkamuistutukset', 'Muistuttaminen matkan aikana', 'Luodaan ja ajastetaan puhelimessa Androidin hälytysjärjestelmällä. Push-palvelua tai palvelinta ei käytetä', 'Kunnes muistutus näytetään tai lopetat matkan'],
            ['Hakuteksti', 'Paikkojen löytäminen', 'Lähetetään Photon-paikkahakuun', 'RAITTA ei tallenna'],
            ['Polttoaineen hintailmoitukset, jos lähetät sellaisen', 'Hintojen jakaminen muille kuljettajille', 'RAITTAn palvelin; nimeä, sijaintia tai IP-osoitetta ei säilytetä', 'Kunnes uudempi ilmoitus korvaa sen'],
            ['Tieilmoitukset (nopeusvalvonta, poliisi, onnettomuus, vaara), jos lähetät sellaisen, ja vastauksesi ”yhä paikalla / poissa”', 'Muiden kuljettajien varoittaminen', 'RAITTAn palvelin: tyyppi, kohta tiellä ja aika; nimeä, laitetunnusta tai IP-osoitetta ei säilytetä', '2–4 tuntia viimeisimmästä vahvistuksesta, aiemmin jos kuljettajat ilmoittavat sen poistuneen'],
            ['Suosikkipaikat', 'Näyttäminen kartalla ja suosikeissa', 'Vain sovelluksen tallennustilassa puhelimessasi', 'Kunnes poistat ne tai sovelluksen'],
            ['IP-osoite ja pyynnön tiedot', 'Tietojen toimittaminen ja palvelun turvallisuus', 'Jokainen palvelu, johon sovellus yhdistää, ks. kohta 4', 'Lyhytaikaiset palvelinlokit'],
          ],
        },
      },
      {
        id: 'connections',
        title: '4. Palvelut, joihin sovellus yhdistää',
        paragraphs: [
          'Sovelluksessa ei ole mainos-, analytiikka-, kaatumisraportti-, attribuutio- tai some-kirjastoja, eikä se käytä Firebasea tai push-palveluita. Se yhdistää vain alla oleviin palveluihin, jotka käsittelevät yhteyttä omien selosteidensa mukaan:',
        ],
        items: [
          'raitta.fi, palveluntarjoajana Vercel Inc.: aikataulut, kaupunkitiedot, hinta- ja tieilmoitukset, paikkojen tiedot ja sovelluksen palvelintoiminnot.',
          'Google Play -palvelut puhelimessasi: Androidin sijaintipalvelu, jonka kautta sovellus lukee sijaintisi. Siihen sovelletaan Googlen tietosuojakäytäntöä.',
          'OpenFreeMap: karttapalat. Photon (komoot): paikkojen ja huoltoasemien haku. FOSSGIS routing.openstreetmap.de: kävelyreitit. RAITTAn reitityspalvelin route.raitta.fi (Ruotsi): autoreitit, ajo-opastus ja nopeusrajoitukset alku- ja loppupisteestä, reitin muodosta sekä ajon aikana sijainnista, kun tarvitaan uusi reitti; ei tallenneta.',
          'Digitransit, HSL ja ITS Factory: ajoneuvojen sijainnit. Fintraffic Digitraffic: junien ajat, kaukojunat livenä ja asemien lähdöt; latauspisteet ja liikennetiedotteet palvelimemme kautta. Wikimedia: kaupunkien kuvat sekä paikkakorttia avattaessa paikan kuva, Wikipedian kuvaus ja Wikidata.',
          'VR:n lippusovellus VR Matkalla tai sen verkkosivu avautuu vain, kun napautat junatilan lippupainiketta.',
          'Lippusovellukset ja -sivustot avautuvat vain, kun napautat lippulinkkiä, ja niihin sovelletaan niiden omia käytäntöjä.',
          'Osoitteesta raitta.fi ladattu versio tarkistaa käynnistyessään tiedoston raitta.fi/app-version.json kertoakseen, kun päivitys tarvitaan. Pyyntö ei sisällä henkilötietoja. Google Playn versio ei tee tätä, koska Google Play päivittää sen.',
        ],
      },
      {
        id: 'play',
        title: '5. Google Play',
        paragraphs: [
          'Kun asennat sovelluksen Google Playsta, Google käsittelee tiliäsi ja latausta omien ehtojensa ja tietosuojakäytäntönsä mukaan. Jos olet sallinut sen Androidissa, Google voi kerätä kaatumis- ja suorituskykyraportteja. Kehittäjä näkee vain Google Play Consolen yhteenvetotilastot, kuten asennusmäärät ja kaatumisosuudet, eikä koskaan sitä, kuka olet.',
        ],
      },
      {
        id: 'safety',
        title: '6. Yhteenveto tietoturvasta (Data safety)',
        items: [
          'Kerätyt tiedot: sijainti (tarkka ja likimääräinen) sovelluksen toimintoja varten, käsitellään vain käytön aikana eikä ole pakollinen. Sitä ei tallenneta, paitsi lähettämäsi tieilmoituksen kohta, jonka muut kuljettajat näkevät muutaman tunnin ajan ilman mitään tunnistetta.',
          'Kolmansille osapuolille niiden omiin tarkoituksiin jaetut tiedot: ei mitään. Tietoja lähetetään kohdan 4 palveluihin vain pyytämäsi toiminnon suorittamiseksi.',
          'Myydyt tai mainontaan tai seurantaan käytetyt tiedot: ei mitään.',
          'Tiedot salataan siirron aikana: kyllä, kaikki yhteydet käyttävät HTTPS:ää.',
          'Tiliä ei tarvita, joten poistettavaa tiliä ei ole.',
        ],
      },
      {
        id: 'delete',
        title: '7. Tietojen poistaminen',
        paragraphs: ['Kaikki sovelluksen säilyttämä on puhelimessasi, joten voit poistaa sen itse milloin tahansa:'],
        items: [
          'sovelluksessa: Asetukset → Tietosuoja → Poista kaikki tietoni;',
          'Androidissa: Asetukset → Sovellukset → RAITTA → Tallennustila → Tyhjennä tallennustila;',
          'poistamalla sovelluksen, jolloin kaikki sen tiedot poistuvat puhelimesta;',
          'tieilmoitukset poistuvat itsestään 2–4 tunnin kuluttua viimeisimmästä vahvistuksesta;',
          `palvelimella olevan hintailmoituksen tai muun tiedon poistamista voit pyytää osoitteesta ${CONTROLLER.email}, ja se poistetaan kuukauden kuluessa.`,
        ],
      },
      {
        id: 'children',
        title: '8. Lapset',
        paragraphs: [
          'RAITTA on yleinen aikataulusovellus kaikille, eikä sitä ole suunnattu lapsille. Se ei kerää lapsen tunnistavia tietoja. Suomessa alle 13-vuotias tarvitsee huoltajan suostumuksen sijainnin käyttöön, joka on ainoa suostumukseen perustuva käsittely.',
        ],
      },
      {
        id: 'contact',
        title: '9. Muutokset ja yhteystiedot',
        paragraphs: [
          'Jos seloste muuttuu, uusi versio julkaistaan osoitteessa raitta.fi/privacy/android uudella päivämäärällä, ja merkittävät muutokset mainitaan sovelluksen julkaisutiedoissa.',
          `Tietosuojakysymykset ja -pyynnöt: ${CONTROLLER.email}. Muut kysymykset: ${CONTROLLER.general} tai raitta.fi/feedback. Voit myös tehdä valituksen tietosuojavaltuutetulle, tietosuoja.fi.`,
        ],
      },
    ],
  },
};

export const DATA_DELETION: Record<PolicyLanguage, Policy> = {
  en: {
    title: 'Delete your RAITTA data',
    effective: 'RAITTA, by Mark Chaikauskas · Updated 8 November 2026',
    summary: [
      'RAITTA has no accounts, so there is no account to delete.',
      'Almost everything is kept only on your phone.',
      'You can delete it yourself at any time, in two taps.',
      `Anything on our server is deleted within one month of asking.`,
    ],
    sections: [
      {
        id: 'app',
        title: '1. Delete everything in the app',
        items: [
          'Open RAITTA.',
          'Tap the gear button at the top right of the map to open Settings.',
          'Scroll to Privacy and tap “Delete all my data”.',
          'Tap again to confirm. Your favourites, recent places, search history and settings are deleted at once, and the app starts afresh.',
        ],
      },
      {
        id: 'android',
        title: '2. Or delete it in Android',
        items: [
          'Open Android Settings → Apps → RAITTA → Storage, and tap “Clear storage”; or',
          'uninstall RAITTA, which removes all of its data from the phone.',
        ],
      },
      {
        id: 'server',
        title: '3. Ask us to delete data on our server',
        paragraphs: [
          `Write to ${CONTROLLER.email} with the subject “Delete my data”. Tell us what you sent, for example the fuel price you reported or the feedback message and the email address you used, as RAITTA has no account to find it by. We delete it within one month and confirm by email.`,
        ],
      },
      {
        id: 'kept',
        title: '4. What is deleted and what is kept',
        table: {
          head: ['Data', 'Where it is', 'How it is deleted', 'Kept for'],
          rows: [
            ['Favourite stops, lines and places, recent places, search history, settings', 'Only on your phone', 'Steps 1 or 2', 'Until you delete it'],
            ['Saved timetables and map tiles', 'Only on your phone; no personal data', 'Step 2', 'Replaced as newer data loads'],
            ['Fuel price reports', 'RAITTA’s server; no name, location or IP address', 'Replaced by a newer report, or step 3', 'Until a newer report for the station'],
            ['Road reports (camera, police, accident, hazard)', 'RAITTA’s server: kind, point and time; no name, device ID or IP address', 'Deleted automatically', '2–4 hours after the last confirmation'],
            ['Feedback sent from raitta.fi/feedback', 'With the developer, through Telegram', 'Step 3', 'Up to 12 months, then deleted'],
            ['Tester sign-up from raitta.fi/testers', 'With the developer, through Telegram, and in the Google Play tester list', 'Step 3, or leave the test in Google Play', 'Until the test ends or you ask'],
            ['IP address in server logs', 'Our host Vercel', 'Deleted automatically', 'Short-term logs only'],
            ['Your location', 'Not stored anywhere', 'Nothing to delete', 'Only while the app is open'],
          ],
        },
        paragraphs: [
          'Your Google account and the record of installing the app are held by Google, not by RAITTA, and are managed in your Google account.',
        ],
      },
      {
        id: 'contact',
        title: 'Contact',
        paragraphs: [`Privacy questions: ${CONTROLLER.email}. More about how RAITTA handles data: raitta.fi/privacy and raitta.fi/privacy/android.`],
      },
    ],
  },
  fi: {
    title: 'RAITTA-tietojen poistaminen',
    effective: 'RAITTA, Mark Chaikauskas · Päivitetty 8.11.2026',
    summary: [
      'RAITTAssa ei ole tilejä, joten poistettavaa tiliä ei ole.',
      'Lähes kaikki säilyy vain puhelimessasi.',
      'Voit poistaa sen itse milloin tahansa kahdella napautuksella.',
      'Palvelimella oleva tieto poistetaan kuukauden kuluessa pyynnöstä.',
    ],
    sections: [
      {
        id: 'app',
        title: '1. Poista kaikki sovelluksessa',
        items: [
          'Avaa RAITTA.',
          'Avaa asetukset napauttamalla rataspainiketta kartan oikeassa yläkulmassa.',
          'Vieritä kohtaan Tietosuoja ja napauta ”Poista kaikki tietoni”.',
          'Vahvista napauttamalla uudelleen. Suosikit, viimeisimmät paikat, hakuhistoria ja asetukset poistuvat heti, ja sovellus alkaa alusta.',
        ],
      },
      {
        id: 'android',
        title: '2. Tai poista ne Androidissa',
        items: [
          'Avaa Androidin Asetukset → Sovellukset → RAITTA → Tallennustila ja napauta ”Tyhjennä tallennustila”; tai',
          'poista RAITTA, jolloin kaikki sen tiedot poistuvat puhelimesta.',
        ],
      },
      {
        id: 'server',
        title: '3. Pyydä poistamaan palvelimella olevat tiedot',
        paragraphs: [
          `Kirjoita osoitteeseen ${CONTROLLER.email} aiheella ”Poista tietoni”. Kerro, mitä lähetit, esimerkiksi ilmoittamasi polttoaineen hinta tai palauteviesti ja käyttämäsi sähköpostiosoite, koska RAITTAssa ei ole tiliä, jonka perusteella sen löytäisi. Poistamme sen kuukauden kuluessa ja vahvistamme sähköpostilla.`,
        ],
      },
      {
        id: 'kept',
        title: '4. Mitä poistetaan ja mitä säilytetään',
        table: {
          head: ['Tieto', 'Missä se on', 'Miten se poistetaan', 'Säilytysaika'],
          rows: [
            ['Suosikkipysäkit, -linjat ja -paikat, viimeisimmät paikat, hakuhistoria, asetukset', 'Vain puhelimessasi', 'Kohta 1 tai 2', 'Kunnes poistat ne'],
            ['Tallennetut aikataulut ja karttapalat', 'Vain puhelimessasi; ei henkilötietoja', 'Kohta 2', 'Korvataan uudemmilla tiedoilla'],
            ['Polttoaineen hintailmoitukset', 'RAITTAn palvelin; ei nimeä, sijaintia tai IP-osoitetta', 'Uudempi ilmoitus korvaa, tai kohta 3', 'Kunnes asemalle tulee uudempi ilmoitus'],
            ['Tieilmoitukset (nopeusvalvonta, poliisi, onnettomuus, vaara)', 'RAITTAn palvelin: tyyppi, kohta ja aika; ei nimeä, laitetunnusta tai IP-osoitetta', 'Poistuu automaattisesti', '2–4 tuntia viimeisimmästä vahvistuksesta'],
            ['Palaute osoitteesta raitta.fi/feedback', 'Kehittäjällä Telegramin kautta', 'Kohta 3', 'Enintään 12 kuukautta, sitten poistetaan'],
            ['Testaajailmoittautuminen osoitteesta raitta.fi/testers', 'Kehittäjällä Telegramin kautta ja Google Playn testaajalistassa', 'Kohta 3, tai poistu testistä Google Playssa', 'Kunnes testi päättyy tai pyydät'],
            ['IP-osoite palvelinlokeissa', 'Palveluntarjoaja Vercel', 'Poistuu automaattisesti', 'Vain lyhytaikaiset lokit'],
            ['Sijaintisi', 'Ei tallenneta mihinkään', 'Ei poistettavaa', 'Vain sovelluksen ollessa auki'],
          ],
        },
        paragraphs: [
          'Google-tiliäsi ja tietoa sovelluksen asentamisesta säilyttää Google, ei RAITTA, ja niitä hallitaan Google-tililläsi.',
        ],
      },
      {
        id: 'contact',
        title: 'Yhteystiedot',
        paragraphs: [`Tietosuojakysymykset: ${CONTROLLER.email}. Lisää RAITTAn tietojen käsittelystä: raitta.fi/privacy ja raitta.fi/privacy/android.`],
      },
    ],
  },
};
