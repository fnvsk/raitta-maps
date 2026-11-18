export interface Category {
  id: string;

  tags: string[];

  words: string[];
}

export const CATEGORIES: Category[] = [
  { id: 'airport', tags: [], words: ['аэропорт', 'аэропорты', 'аэродром', 'самолёт', 'самолет', 'рейс', 'рейсы', 'вылет', 'airport', 'airports', 'flights', 'plane', 'lentoasema', 'lentokenttä', 'lentokentta', 'lento', 'lennot', 'flygplats', 'flygfält', 'flyg', 'lennujaam', 'lennuväli', 'lennuk'] },
  { id: 'station', tags: ['railway:station', 'railway:halt'], words: ['вокзал', 'жд вокзал', 'ж/д вокзал', 'железнодорожный вокзал', 'жд', 'ж/д', 'станция', 'поезд', 'поезда', 'электричка', 'railway station', 'train station', 'railway', 'station', 'train', 'trains', 'rautatieasema', 'rautatie', 'juna-asema', 'juna', 'junat', 'asema', 'järnvägsstation', 'järnväg', 'tågstation', 'tåg', 'raudteejaam', 'rongijaam', 'raudtee', 'rong'] },
  { id: 'bus_station', tags: ['amenity:bus_station'], words: ['автовокзал', 'автостанция', 'автобусная станция', 'междугородний автобус', 'bus station', 'coach station', 'bus terminal', 'linja-autoasema', 'linja-auto', 'matkakeskus', 'busstation', 'bussterminal', 'bussijaam', 'bussiterminal'] },
  { id: 'ferry', tags: ['amenity:ferry_terminal'], words: ['порт', 'паром', 'паромы', 'морской вокзал', 'терминал', 'ferry', 'ferries', 'ferry terminal', 'harbour', 'port', 'satama', 'lautta', 'laiva', 'terminaali', 'matkustajasatama', 'hamn', 'färja', 'färjeterminal', 'sadam', 'praam', 'laevaterminal', 'reisisadam'] },
  { id: 'fuel', tags: ['amenity:fuel'], words: ['азс', 'заправка', 'бензин', 'бензоколонка', 'fuel', 'gas station', 'petrol', 'petrol station', 'huoltoasema', 'bensa', 'bensiini', 'bensa-asema', 'tankkaus', 'bensinstation', 'mack', 'tankla', 'bensiinijaam'] },
  { id: 'charging', tags: ['amenity:charging_station'], words: ['зарядка', 'электрозарядка', 'зарядная станция', 'charger', 'charging', 'ev charging', 'lataus', 'latauspiste', 'latausasema', 'laddning', 'laddstation', 'laadimine', 'laadija', 'laadimisjaam'] },
  { id: 'school', tags: ['amenity:school'], words: ['школа', 'school', 'koulu', 'peruskoulu', 'lukio', 'skola', 'gymnasium', 'kool'] },
  { id: 'university', tags: ['amenity:university', 'amenity:college'], words: ['университет', 'вуз', 'институт', 'колледж', 'university', 'college', 'yliopisto', 'korkeakoulu', 'ammattikorkeakoulu', 'amk', 'universitet', 'högskola', 'ülikool', 'kõrgkool'] },
  { id: 'kindergarten', tags: ['amenity:kindergarten'], words: ['детский сад', 'детсад', 'садик', 'kindergarten', 'daycare', 'päiväkoti', 'daghem', 'förskola', 'lasteaed'] },
  { id: 'grocery', tags: ['shop:supermarket', 'shop:convenience'], words: ['продукты', 'супермаркет', 'продуктовый', 'магазин', 'grocery', 'supermarket', 'shop', 'kauppa', 'ruokakauppa', 'lähikauppa', 'market', 'matbutik', 'mataffär', 'butik', 'toidupood', 'pood', 'kauplus'] },
  { id: 'mall', tags: ['shop:mall', 'shop:department_store'], words: ['торговый центр', 'тц', 'молл', 'mall', 'shopping centre', 'shopping center', 'kauppakeskus', 'köpcentrum', 'kaubanduskeskus'] },
  { id: 'pharmacy', tags: ['amenity:pharmacy'], words: ['аптека', 'pharmacy', 'chemist', 'apteekki', 'apotek', 'apteek'] },
  { id: 'health', tags: ['amenity:hospital', 'amenity:clinic', 'amenity:doctors'], words: ['больница', 'поликлиника', 'клиника', 'врач', 'hospital', 'clinic', 'doctor', 'sairaala', 'terveysasema', 'lääkäri', 'sjukhus', 'hälsocentral', 'läkare', 'haigla', 'arst', 'kliinik'] },
  { id: 'dentist', tags: ['amenity:dentist'], words: ['стоматолог', 'стоматология', 'зубной', 'dentist', 'hammaslääkäri', 'tandläkare', 'hambaarst'] },
  { id: 'cafe', tags: ['amenity:cafe'], words: ['кафе', 'кофе', 'кофейня', 'cafe', 'café', 'coffee', 'kahvila', 'kahvi', 'kafé', 'kaffe', 'kohvik'] },
  { id: 'restaurant', tags: ['amenity:restaurant', 'amenity:fast_food'], words: ['ресторан', 'поесть', 'еда', 'фастфуд', 'пицца', 'restaurant', 'food', 'fast food', 'pizza', 'ravintola', 'ruoka', 'pikaruoka', 'pizzeria', 'lounas', 'restaurang', 'mat', 'restoran', 'söögikoht'] },
  { id: 'bar', tags: ['amenity:bar', 'amenity:pub'], words: ['бар', 'паб', 'bar', 'pub', 'baari', 'pubi', 'krog', 'baar'] },
  { id: 'atm', tags: ['amenity:atm', 'amenity:bank'], words: ['банкомат', 'банк', 'atm', 'bank', 'cash', 'pankkiautomaatti', 'otto', 'pankki', 'bankomat', 'uttagsautomat', 'pangaautomaat', 'pank'] },
  { id: 'parking', tags: ['amenity:parking'], words: ['парковка', 'стоянка', 'parking', 'car park', 'pysäköinti', 'parkki', 'parkkipaikka', 'parkkihalli', 'parkering', 'parkla'] },
  { id: 'toilets', tags: ['amenity:toilets'], words: ['туалет', 'уборная', 'toilet', 'toilets', 'wc', 'restroom', 'vessa', 'käymälä', 'toalett', 'tualett'] },
  { id: 'metro', tags: ['railway:subway_entrance', 'station:subway'], words: ['метро', 'станция метро', 'вход в метро', 'metro', 'subway', 'underground', 'metro station', 'metroasema', 'tunnelbana', 'metrostation', 'metroojaam'] },
  { id: 'tramstop', tags: ['railway:tram_stop'], words: ['трамвай', 'трамвайная остановка', 'tram', 'tram stop', 'ratikka', 'raitiovaunu', 'ratikkapysäkki', 'spårvagn', 'spårvagnshållplats', 'tramm', 'trammipeatus'] },
  { id: 'busstop', tags: ['highway:bus_stop'], words: ['остановка', 'автобусная остановка', 'автобус', 'bus stop', 'bus', 'pysäkki', 'bussipysäkki', 'bussi', 'hållplats', 'busshållplats', 'buss', 'peatus', 'bussipeatus'] },
  { id: 'theatre', tags: ['amenity:theatre', 'amenity:arts_centre', 'amenity:concert_hall'], words: ['театр', 'концерт', 'концертный зал', 'опера', 'theatre', 'theater', 'concert hall', 'opera', 'teatteri', 'konserttitalo', 'ooppera', 'teater', 'konserthus', 'kontserdisaal'] },
  { id: 'beach', tags: ['natural:beach', 'leisure:beach_resort'], words: ['пляж', 'купаться', 'beach', 'uimaranta', 'ranta', 'badstrand', 'strand', 'rand', 'supelrand'] },
  { id: 'zoo', tags: ['tourism:zoo', 'tourism:theme_park', 'tourism:aquarium'], words: ['зоопарк', 'парк развлечений', 'аквапарк', 'аттракционы', 'zoo', 'theme park', 'amusement park', 'aquarium', 'eläintarha', 'huvipuisto', 'kylpylä', 'djurpark', 'nöjespark', 'loomaaed', 'lõbustuspark'] },
  { id: 'stadium', tags: ['leisure:stadium', 'leisure:sports_centre', 'leisure:ice_rink'], words: ['стадион', 'спорткомплекс', 'каток', 'арена', 'stadium', 'arena', 'sports centre', 'ice rink', 'stadion', 'urheilukeskus', 'jäähalli', 'areena', 'idrottscentrum', 'ishall', 'spordikeskus', 'jäähall'] },
  { id: 'taxi', tags: ['amenity:taxi'], words: ['такси', 'taxi', 'cab', 'taksi', 'taksitolppa'] },
  { id: 'carrental', tags: ['amenity:car_rental', 'amenity:car_sharing'], words: ['аренда авто', 'прокат авто', 'каршеринг', 'car rental', 'rent a car', 'car sharing', 'autovuokraamo', 'vuokra-auto', 'biluthyrning', 'autorent'] },
  { id: 'bikes', tags: ['amenity:bicycle_rental', 'shop:bicycle'], words: ['велосипед', 'прокат велосипедов', 'городской велосипед', 'bike', 'bicycle', 'city bike', 'bike rental', 'pyörä', 'kaupunkipyörä', 'polkupyörä', 'cykel', 'stadscykel', 'jalgratas', 'linnaratas'] },
  { id: 'vet', tags: ['amenity:veterinary', 'shop:pet'], words: ['ветеринар', 'ветклиника', 'зоомагазин', 'vet', 'veterinary', 'pet shop', 'eläinlääkäri', 'eläinkauppa', 'veterinär', 'djuraffär', 'veterinaar', 'lemmikloomapood'] },
  { id: 'bakery', tags: ['shop:bakery', 'shop:pastry'], words: ['пекарня', 'булочная', 'кондитерская', 'хлеб', 'bakery', 'bread', 'pastry', 'leipomo', 'konditoria', 'bageri', 'konditori', 'pagarikoda', 'kondiitriäri'] },
  { id: 'hairdresser', tags: ['shop:hairdresser', 'shop:beauty'], words: ['парикмахерская', 'барбершоп', 'салон красоты', 'стрижка', 'hairdresser', 'barber', 'beauty salon', 'kampaamo', 'parturi', 'kauneushoitola', 'frisör', 'skönhetssalong', 'juuksur', 'ilusalong'] },
  { id: 'laundry', tags: ['shop:laundry', 'shop:dry_cleaning'], words: ['прачечная', 'химчистка', 'laundry', 'dry cleaning', 'pesula', 'tvätteri', 'kemtvätt', 'pesumaja', 'keemiline puhastus'] },
  { id: 'clothes', tags: ['shop:clothes', 'shop:shoes'], words: ['одежда', 'обувь', 'магазин одежды', 'clothes', 'clothing', 'shoes', 'fashion', 'vaatekauppa', 'vaatteet', 'kenkäkauppa', 'kläder', 'skor', 'riided', 'jalanõud'] },
  { id: 'electronics', tags: ['shop:electronics', 'shop:mobile_phone', 'shop:computer'], words: ['электроника', 'телефоны', 'компьютеры', 'техника', 'electronics', 'phone shop', 'computer', 'elektroniikka', 'kodinkoneet', 'puhelinkauppa', 'elektronik', 'elektroonika'] },
  { id: 'hardware', tags: ['shop:hardware', 'shop:doityourself', 'shop:furniture'], words: ['стройматериалы', 'хозтовары', 'мебель', 'икея', 'hardware', 'diy', 'furniture', 'ikea', 'rautakauppa', 'huonekalut', 'järnhandel', 'möbler', 'ehituspood', 'mööbel'] },
  { id: 'books', tags: ['shop:books', 'shop:stationery'], words: ['книжный', 'книги', 'канцтовары', 'bookstore', 'books', 'kirjakauppa', 'kirjat', 'bokhandel', 'raamatupood'] },
  { id: 'flowers', tags: ['shop:florist', 'shop:garden_centre'], words: ['цветы', 'цветочный', 'florist', 'flowers', 'kukkakauppa', 'kukat', 'blomsteraffär', 'blommor', 'lillepood', 'lilled'] },
  { id: 'optician', tags: ['shop:optician'], words: ['оптика', 'очки', 'optician', 'glasses', 'optikko', 'silmälasit', 'optiker', 'optika', 'prillid'] },
  { id: 'kiosk', tags: ['shop:kiosk'], words: ['киоск', 'ларёк', 'kiosk', 'r-kioski', 'kioski'] },
  { id: 'camping', tags: ['tourism:camp_site', 'tourism:caravan_site'], words: ['кемпинг', 'палатка', 'camping', 'campsite', 'leirintäalue', 'kämping', 'telkimisplats'] },
  { id: 'viewpoint', tags: ['tourism:viewpoint', 'tourism:attraction'], words: ['смотровая', 'смотровая площадка', 'достопримечательность', 'достопримечательности', 'viewpoint', 'sights', 'attraction', 'näköalapaikka', 'nähtävyys', 'nähtävyydet', 'utsiktsplats', 'sevärdhet', 'vaateplats', 'vaatamisväärsus'] },
  { id: 'nature', tags: ['leisure:nature_reserve', 'boundary:national_park'], words: ['природа', 'заповедник', 'национальный парк', 'nature', 'nature reserve', 'national park', 'luonto', 'kansallispuisto', 'luonnonsuojelualue', 'naturreservat', 'nationalpark', 'loodus', 'rahvuspark'] },
  { id: 'embassy', tags: ['office:diplomatic', 'amenity:embassy'], words: ['посольство', 'консульство', 'embassy', 'consulate', 'suurlähetystö', 'konsulaatti', 'ambassad', 'konsulat', 'saatkond', 'konsulaat'] },
  { id: 'cars', tags: ['shop:car', 'shop:tyres', 'amenity:vehicle_inspection'], words: ['автосалон', 'шиномонтаж', 'шины', 'техосмотр', 'car dealer', 'tyres', 'tires', 'inspection', 'autoliike', 'rengasliike', 'renkaat', 'katsastus', 'bilaffär', 'däck', 'besiktning', 'autoesindus', 'rehvid', 'ülevaatus'] },
  { id: 'hotel', tags: ['tourism:hotel', 'tourism:hostel', 'tourism:guest_house'], words: ['отель', 'гостиница', 'хостел', 'hotel', 'hostel', 'hotelli', 'hostelli', 'hotell', 'vandrarhem'] },
  { id: 'museum', tags: ['tourism:museum'], words: ['музей', 'museum', 'museo', 'muuseum'] },
  { id: 'library', tags: ['amenity:library'], words: ['библиотека', 'library', 'kirjasto', 'bibliotek', 'raamatukogu'] },
  { id: 'post', tags: ['amenity:post_office', 'amenity:parcel_locker'], words: ['почта', 'посылка', 'постамат', 'post office', 'post', 'parcel', 'posti', 'postiautomaatti', 'pakettiautomaatti', 'posten', 'paketautomat', 'postkontor', 'pakiautomaat'] },
  { id: 'gym', tags: ['leisure:fitness_centre'], words: ['спортзал', 'фитнес', 'тренажерный зал', 'gym', 'fitness', 'kuntosali', 'sali', 'gym', 'jõusaal'] },
  { id: 'swimming', tags: ['leisure:swimming_pool', 'leisure:water_park'], words: ['бассейн', 'аквапарк', 'swimming pool', 'swimming', 'pool', 'uimahalli', 'uimala', 'kylpylä', 'simhall', 'ujula', 'veekeskus'] },
  { id: 'sauna', tags: ['leisure:sauna', 'amenity:public_bath'], words: ['сауна', 'баня', 'sauna', 'bastu', 'saun'] },
  { id: 'cinema', tags: ['amenity:cinema'], words: ['кино', 'кинотеатр', 'cinema', 'movies', 'elokuvateatteri', 'elokuvat', 'leffa', 'bio', 'biograf', 'kino'] },
  { id: 'church', tags: ['amenity:place_of_worship'], words: ['церковь', 'храм', 'собор', 'church', 'kirkko', 'kyrka', 'kirik'] },
  { id: 'park', tags: ['leisure:park'], words: ['парк', 'сквер', 'park', 'puisto', 'park', 'park'] },
  { id: 'playground', tags: ['leisure:playground'], words: ['детская площадка', 'playground', 'leikkipuisto', 'leikkipaikka', 'lekpark', 'mänguväljak'] },
  { id: 'police', tags: ['amenity:police'], words: ['полиция', 'police', 'poliisi', 'polis', 'politsei'] },
  { id: 'alcohol', tags: ['shop:alcohol'], words: ['алкоголь', 'алко', 'alcohol', 'liquor', 'alko', 'systembolaget', 'alkohol'] },
  { id: 'carwash', tags: ['amenity:car_wash'], words: ['мойка', 'автомойка', 'car wash', 'autopesu', 'autopesula', 'biltvätt'] },
  { id: 'carrepair', tags: ['shop:car_repair', 'shop:tyres'], words: ['автосервис', 'шиномонтаж', 'ремонт авто', 'car repair', 'garage', 'tyres', 'autokorjaamo', 'korjaamo', 'rengasliike', 'bilverkstad', 'däck', 'autoremont', 'rehvivahetus'] },
];

export const foldWord = (text: string) =>
  text.toLowerCase().replace(/ё/g, 'е').normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim();

const folded = CATEGORIES.map((category) => ({ category, words: category.words.map(foldWord) }));

export function matchCategory(query: string): Category | null {
  const text = foldWord(query);
  if (text.length < 2) return null;
  let best: { category: Category; length: number } | null = null;
  for (const { category, words } of folded) {
    for (const word of words) {
      const hit = word === text || (text.length >= 4 && word.startsWith(text));
      if (hit && (!best || word.length < best.length)) best = { category, length: word.length };
    }
  }
  return best?.category ?? null;
}
