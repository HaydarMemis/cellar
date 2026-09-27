/**
 * Turkish translations of the free-form prose fields for every built-in
 * cocktail: description, steps, and garnish. Everything else (ingredients,
 * amounts, method, category/tag ids, glass ids, difficulty, ABV) is
 * language-independent and resolved through vocab/ingredient dictionaries
 * instead — see src/domain/cocktailContent.ts. English itself is not
 * duplicated here; it stays single-sourced in src/data/catalog/cocktails/*.
 */
export interface CocktailContentOverride {
  description: string;
  steps: string[];
  garnish?: string;
}

export const catalogOverrides: Record<string, CocktailContentOverride> = {
  // ---- classics ----
  'old-fashioned': {
    description:
      'Bourbon, şeker ve bitter, buzla karıştırılır ve portakal kabuğuyla süslenir. Var olan en eski kokteyl formatlarından biri.',
    steps: [
      'Bardağa şeker ve bitteri bir tutam suyla ekleyin, eriyene kadar karıştırın.',
      'Buzla doldurun ve bourbonu ekleyin.',
      'İyice soğuyana kadar karıştırın.',
      'Bir portakal kabuğunu üzerine sıkarak yağını çıkarın ve bardağa bırakın.',
    ],
    garnish: 'Portakal kabuğu',
  },
  manhattan: {
    description: 'Çavdar viskisi ve tatlı vermut, bitterle karıştırılır. İçki ağırlıklı ve klasik.',
    steps: [
      'Tüm malzemeleri buzla birlikte bir karıştırma bardağına ekleyin.',
      'İyice soğuyana kadar karıştırın.',
      'Soğutulmuş bir coupe kadehine süzün.',
    ],
    garnish: 'Maraschino vişnesi',
  },
  martini: {
    description: 'Cin ve sek vermut, buz gibi ve ipeksi olana kadar karıştırılır. Kokteylin arketipi.',
    steps: [
      'Cin ve vermutu buzla birlikte bir karıştırma bardağına ekleyin.',
      'İyice soğuyana kadar karıştırın.',
      'Soğutulmuş bir martini kadehine süzün.',
    ],
    garnish: 'Limon kabuğu ya da zeytin',
  },
  negroni: {
    description: 'Eşit oranda cin, Campari ve tatlı vermut. Acı, cesur ve sonsuz varyasyonu olan bir kokteyl.',
    steps: [
      'Tüm malzemeleri buzla dolu bir rocks bardağına ekleyin.',
      'İyice soğuyana kadar karıştırın.',
      'Bir dilim portakalla süsleyin.',
    ],
    garnish: 'Portakal dilimi',
  },
  boulevardier: {
    description: "Negroni'nin viski ile yanıtı: bourbon, Campari ve tatlı vermut.",
    steps: [
      'Tüm malzemeleri buzla birlikte bir karıştırma bardağına ekleyin.',
      'İyice soğuyana kadar karıştırın.',
      'Taze buz üzerine, bir rocks bardağına süzün.',
      'Bir portakal kabuğuyla süsleyin.',
    ],
    garnish: 'Portakal kabuğu',
  },
  sazerac: {
    description:
      "Çavdar viskisi, şeker ve Peychaud's bitter, absinth ile durulanmış bir bardakta. New Orleans klasiği.",
    steps: [
      'Soğutulmuş bir rocks bardağını absinth ile durulayın ve fazlasını dökün.',
      'Çavdar viskisini, şekeri ve bitteri buzla birlikte bir karıştırma bardağında soğuyana kadar karıştırın.',
      'Hazırladığınız bardağa (buzsuz) süzün.',
      'Bir limon kabuğunu üzerine sıkarak yağını çıkarın ve atın.',
    ],
    garnish: 'Limon kabuğu (sıkılıp atılır)',
  },
  'vieux-carre': {
    description: "Çavdar viskisi, konyak, tatlı vermut, Bénédictine ve iki çeşit bitter. Zengin ve katmanlı.",
    steps: [
      'Tüm malzemeleri buzla birlikte bir karıştırma bardağına ekleyin.',
      'İyice soğuyana kadar karıştırın.',
      'Taze buz üzerine, bir rocks bardağına süzün.',
      'Bir limon kabuğuyla süsleyin.',
    ],
    garnish: 'Limon kabuğu',
  },
  'rob-roy': {
    description: 'Çavdar viskisi yerine İskoç viskisiyle yapılan bir Manhattan.',
    steps: [
      'Tüm malzemeleri buzla birlikte bir karıştırma bardağına ekleyin.',
      'İyice soğuyana kadar karıştırın.',
      'Soğutulmuş bir coupe kadehine süzün.',
    ],
    garnish: 'Maraschino vişnesi',
  },
  martinez: {
    description:
      "Cin, tatlı vermut, maraschino likörü ve bitter — genellikle Martini'nin öncüsü olarak kabul edilir.",
    steps: [
      'Tüm malzemeleri buzla birlikte bir karıştırma bardağına ekleyin.',
      'İyice soğuyana kadar karıştırın.',
      'Soğutulmuş bir coupe kadehine süzün.',
      'Bir limon kabuğuyla süsleyin.',
    ],
    garnish: 'Limon kabuğu',
  },
  vesper: {
    description:
      "Cin, votka ve Lillet Blanc, çalkalanarak hazırlanır. Ian Fleming'in Casino Royale romanıyla ünlendi.",
    steps: [
      'Tüm malzemeleri buzla çalkalayın.',
      'Soğutulmuş bir martini kadehine süzün.',
      'Bir limon kabuğuyla süsleyin.',
    ],
    garnish: 'Limon kabuğu',
  },
  'corpse-reviver-no-2': {
    description:
      'Cin, triple sec, Lillet Blanc ve limon suyu, absinth durulamasıyla. Göründüğünden çok daha kolay içiliyor.',
    steps: [
      'Soğutulmuş bir coupe kadehini absinth ile durulayın ve fazlasını dökün.',
      'Kalan malzemeleri buzla çalkalayın.',
      'Hazırladığınız kadehe süzün.',
    ],
  },
  'last-word': {
    description:
      'Eşit oranda cin, yeşil Chartreuse, maraschino likörü ve misket limonu suyu. Yasaklama dönemine ait, yeniden keşfedilmiş bir kokteyl.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  'paper-plane': {
    description:
      "Eşit oranda bourbon, Aperol, Amaro Nonino ve limon suyu. 21. yüzyılın tanınmış modern klasiklerinden.",
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  'bees-knees': {
    description:
      'Cin, limon suyu ve bal şurubu. Kalitesiz içkinin tadını bastırmak için tasarlanmış, Yasaklama dönemi favorisi.',
    steps: [
      'Tüm malzemeleri buzla çalkalayın.',
      'Soğutulmuş bir coupe kadehine süzün.',
      'Bir limon kabuğuyla süsleyin.',
    ],
    garnish: 'Limon kabuğu',
  },
  'between-the-sheets': {
    description: "Konyak, beyaz rom, triple sec ve limon suyu — rom omurgalı bir Sidecar.",
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  'brandy-alexander': {
    description: 'Konyak, kakao likörü ve krema, köpürene kadar çalkalanır. Bir tatlı kokteyli.',
    steps: [
      'Tüm malzemeleri iyice soğuyana kadar buzla çalkalayın.',
      'Soğutulmuş bir coupe kadehine süzün.',
      'Üzerine muskat rendeleyin.',
    ],
    garnish: 'Rendelenmiş muskat',
  },
  'irish-coffee': {
    description:
      'İrlanda viskisi ve şeker, sıcak kahvenin içinde; üzerine hafif çırpılmış krema eklenir.',
    steps: [
      'Bir bardağı ısıtın ve viskiyi, sıcak kahveyi ve şurubu ekleyin.',
      'Karışana kadar karıştırın.',
      'Kremayı bir kaşığın sırtından dökerek nazıkçe üzerinde yüzdürün.',
    ],
  },
  godfather: {
    description: 'İskoç viskisi ve amaretto, buz üzerinde. İki malzeme, hiç uğraş yok.',
    steps: ['Malzemeleri buzla dolu bir rocks bardağına ekleyin.', 'Kısaca karıştırın.'],
  },
  'rusty-nail': {
    description: 'İskoç viskisi ve Drambuie, buz üzerinde. Tatlı, ballı ve sert.',
    steps: ['Malzemeleri buzla dolu bir rocks bardağına ekleyin.', 'Kısaca karıştırın.'],
  },
  'ward-8': {
    description:
      'Çavdar viskisi, limon suyu, portakal suyu ve nar şurubu. Yasaklama öncesi dönemden bir Boston klasiği.',
    steps: [
      'Tüm malzemeleri buzla çalkalayın.',
      'Soğutulmuş bir coupe kadehine ya da taze buz üzerine süzün.',
    ],
  },
  'french-martini': {
    description: 'Votka, ahududu likörü ve ananas suyu, köpürene kadar çalkalanır.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir martini kadehine süzün.'],
  },
  'kir-royale': {
    description: 'Frenk üzümü likörünün üzerine soğuk şampanya eklenir. Basit ve kutlama havasında.',
    steps: [
      'Frenk üzümü likörünü bir şampanya flüt kadehine ekleyin.',
      'Üzerine soğuk şampanya ekleyin.',
    ],
  },

  // ---- sours ----
  'whiskey-sour': {
    description:
      'Bourbon, limon suyu ve şeker şurubu, köpürene kadar çalkalanır. Yumurta akı opsiyoneldir ama gelenekseldir.',
    steps: [
      'Yumurta akı kullanıyorsanız, önce tüm malzemeleri buzsuz çalkalayarak emülsiye edin.',
      'Buz ekleyin ve iyice soğuyana kadar tekrar çalkalayın.',
      'Taze buz üzerine, bir rocks bardağına süzün.',
    ],
    garnish: 'Portakal dilimi, vişne',
  },
  daiquiri: {
    description: 'Beyaz rom, misket limonu suyu ve şeker şurubu. Basit, dengeli ve hafife alınması kolay.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  margarita: {
    description:
      'Blanco tekila, triple sec ve taze misket limonu suyu, çalkalanır; tuzlu ya da tuzsuz servis edilir.',
    steps: [
      'Dilerseniz bir rocks bardağının kenarını tuzlayın.',
      'Tüm malzemeleri buzla çalkalayın.',
      'Taze buz üzerine bardağa süzün.',
    ],
    garnish: 'Misket limonu dilimi, tuz kenar',
  },
  sidecar: {
    description: 'Konyak, triple sec ve limon suyu, geleneksel olarak şeker kenarlı bir kadehte servis edilir.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş, şeker kenarlı bir coupe kadehine süzün.'],
    garnish: 'Şeker kenar',
  },
  'pisco-sour': {
    description:
      'İpeksi bir köpük için yumurta akıyla buzsuz çalkalanan pisco, misket limonu suyu ve şeker şurubu.',
    steps: [
      'Bitter hariç tüm malzemeleri buzsuz çalkalayarak emülsiye edin.',
      'Buz ekleyin ve iyice soğuyana kadar tekrar çalkalayın.',
      'Soğutulmuş bir kadehe süzün.',
      'Köpüğün üzerine birkaç damla bitter damlatarak süsleyin.',
    ],
    garnish: 'Angostura bitter damlaları',
  },
  'clover-club': {
    description: 'Cin, limon suyu, ahududu şurubu ve yumurta akı. Pembe, köpüklü ve Yasaklama öncesinden.',
    steps: [
      'Tüm malzemeleri buzsuz çalkalayarak emülsiye edin.',
      'Buz ekleyin ve iyice soğuyana kadar tekrar çalkalayın.',
      'Soğutulmuş bir coupe kadehine süzün.',
    ],
    garnish: 'Birkaç ahududu',
  },
  aviation: {
    description: 'Cin, maraschino likörü ve limon suyu; renk için biraz menekşe likörü eklenir.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir coupe kadehine süzün.'],
    garnish: 'Konyaklı vişne',
  },
  'hemingway-daiquiri': {
    description:
      'Beyaz rom, maraschino likörü, misket limonu ve greyfurt suyu. Daha ekşi, daha az tatlı bir daiquiri varyasyonu.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  gimlet: {
    description: 'Cin, misket limonu suyu ve şeker şurubu. Temiz, ekşi ve sade.',
    steps: [
      'Tüm malzemeleri buzla çalkalayın.',
      'Soğutulmuş bir coupe kadehine ya da buz üzerine süzün.',
    ],
  },

  // ---- highballs ----
  mojito: {
    description:
      "Beyaz rom, misket limonu, nane ve soda. Küba'nın en bilinen ihracatı; kırık buz üzerinde ferahlatıcı.",
    steps: [
      'Nane yapraklarını bardakta şeker şurubuyla nazıkçe ezin.',
      'Misket limonu suyunu, romu ve buzu ekleyin.',
      'Üzerine soda ekleyip karıştırın.',
      'Bir dal nane ile süsleyin.',
    ],
    garnish: 'Nane dalı',
  },
  'moscow-mule': {
    description: 'Votka, misket limonu suyu ve zencefilli bira; geleneksel olarak bakır bir kupada servis edilir.',
    steps: [
      'Bakır bir kupayı ya da bardağı buzla doldurun.',
      'Votkayı ve misket limonu suyunu ekleyin.',
      'Üzerine zencefilli bira ekleyip hafifçe karıştırın.',
    ],
    garnish: 'Misket limonu dilimi',
  },
  'tom-collins': {
    description:
      'Üzerine soda eklenen cin, limon suyu ve şeker şurubu. Uzun boylu, kolay bir klasik.',
    steps: [
      'Cini, limon suyunu ve şurubu buzla çalkalayın.',
      'Taze buz üzerine, bir Collins bardağına süzün.',
      'Üzerine soda ekleyip hafifçe karıştırın.',
    ],
    garnish: 'Limon dilimi',
  },
  'gin-tonic': {
    description: 'Cin ve tonik, buz üzerinde. Harika bir içkinin alabileceği en basit hâl.',
    steps: ['Bir bardağı buzla doldurun.', 'Cini ekleyin.', 'Üzerine tonik ekleyip hafifçe karıştırın.'],
    garnish: 'Misket limonu dilimi',
  },
  'dark-n-stormy': {
    description: "Koyu rom, zencefilli biranın üzerinde yüzdürülür. Bermuda'nın ulusal içkisi.",
    steps: [
      'Bir bardağı buzla doldurun ve zencefilli birayı ekleyin.',
      'Koyu romu bir kaşığın üzerinden nazıkçe dökerek yüzdürün.',
      'Bir dilim misket limonuyla süsleyin.',
    ],
    garnish: 'Misket limonu dilimi',
  },
  paloma: {
    description: "Tekila, greyfurt suyu, misket limonu ve soda. Meksika'nın en popüler tekila kokteyli.",
    steps: [
      'Dilerseniz bir highball bardağının kenarını tuzlayın.',
      'Buzla doldurun, tekilayı, greyfurt suyunu ve misket limonu suyunu ekleyin.',
      'Üzerine soda ekleyip hafifçe karıştırın.',
    ],
    garnish: 'Greyfurt dilimi, tuz kenar',
  },
  'cuba-libre': {
    description: 'İsimli bir rom-kola: rom, kola ve bir sıkım misket limonu.',
    steps: [
      'Bir bardağı buzla doldurun.',
      'Romu ve misket limonu suyunu ekleyin.',
      'Üzerine kola ekleyip hafifçe karıştırın.',
    ],
    garnish: 'Misket limonu dilimi',
  },
  'french-75': {
    description:
      "Cin, limon suyu ve şurup, üzerine şampanya eklenir. Adını I. Dünya Savaşı'ndan kalma bir sahra topundan alır.",
    steps: [
      'Cini, limon suyunu ve şurubu buzla çalkalayın.',
      'Bir şampanya flüt kadehine süzün.',
      'Üzerine soğuk şampanya ekleyin.',
    ],
    garnish: 'Limon kabuğu',
  },
  americano: {
    description: "Campari ve tatlı vermut, üzerine soda eklenir. Negroni'den daha hafif ve daha düşük alkollü.",
    steps: [
      'Bir rocks bardağını buzla doldurun.',
      "Campari'yi ve tatlı vermutu ekleyin.",
      'Üzerine soda ekleyip hafifçe karıştırın.',
      'Bir dilim portakalla süsleyin.',
    ],
    garnish: 'Portakal dilimi',
  },
  'salty-dog': {
    description: 'Votka ve greyfurt suyu, tuz kenarlı bir bardakta, buz üzerinde.',
    steps: [
      'Bir highball bardağının kenarını tuzlayın.',
      'Buzla doldurun, votkayı ve greyfurt suyunu ekleyin.',
      'Hafifçe karıştırın.',
    ],
    garnish: 'Tuz kenar',
  },
  'sea-breeze': {
    description: 'Votka, kızılcık suyu ve greyfurt suyu. Canlı pembe rengiyle kolay içilir.',
    steps: [
      'Bir highball bardağını buzla doldurun.',
      'Votkayı, kızılcık suyunu ve greyfurt suyunu ekleyin.',
      'Hafifçe karıştırın.',
    ],
    garnish: 'Misket limonu dilimi',
  },
  'long-island-iced-tea': {
    description:
      'Votka, cin, rom, tekila ve triple sec; limon suyu ve bir tutam kolayla. Göründüğünden çok daha sert.',
    steps: [
      "Tüm içkileri, triple sec'i, limon suyunu ve şurubu buzla dolu bir bardağa ekleyin.",
      'Kısaca karıştırın.',
      'Renk için üzerine bir tutam kola ekleyin.',
    ],
    garnish: 'Limon dilimi',
  },
  'mint-julep': {
    description: "Bourbon ve nane, kırık buz üzerinde. Kentucky Derby'nin geleneksel içkisi.",
    steps: [
      'Nane yapraklarını bir julep kupasında ya da rocks bardağında şurupla nazıkçe ezin.',
      'Kırık buzla doldurun.',
      'Bourbonu ekleyin ve bardak buğulanana kadar karıştırın.',
      'Üzerine biraz daha kırık buz ekleyip bir demet naneyle süsleyin.',
    ],
    garnish: 'Nane demeti',
  },
  southside: {
    description: 'Cin, misket limonu suyu, şeker şurubu ve nane; çalkalanıp ince süzülür.',
    steps: [
      'Tüm malzemeleri (nane yaprakları dahil) buzla çalkalayın.',
      'Soğutulmuş bir coupe kadehine ya da buz üzerine, bir rocks bardağına ince süzün.',
      'Bir nane yaprağıyla süsleyin.',
    ],
    garnish: 'Nane yaprağı',
  },
  caipirinha: {
    description: "Cachaça, misket limonu ve şekerle ezilir. Brezilya'nın ulusal kokteyli.",
    steps: [
      'Misket limonunu (ya da limon dilimlerini) bir rocks bardağında şeker şurubuyla ezin.',
      "Kırık buzla doldurun ve cachaça'yı ekleyin.",
      'İyice karıştırın.',
    ],
  },
  michelada: {
    description:
      'Bira; misket limonu suyu, acı sos ve Worcestershire sosuyla, tuzlu kenarlı bir bardakta. Tuzlu-lezzetli ve ferahlatıcı.',
    steps: [
      "Bir bardağın kenarını tuzlayın.",
      'Misket limonu suyunu, acı sosu ve Worcestershire sosunu buzla birlikte bardağa ekleyin.',
      'Üzerine soğuk bira ekleyip hafifçe karıştırın.',
    ],
    garnish: 'Tuz-biber kenar, misket limonu dilimi',
  },

  // ---- tiki ----
  'mai-tai': {
    description: 'İki çeşit rom, portakal likörü, orgeat ve misket limonu suyu. Tiki barların temel taşı.',
    steps: [
      'Tüm malzemeleri kırık buzla çalkalayın.',
      'Süzmeden bir rocks bardağına dökün.',
      'Bir dal nane ve misket limonu kabuğuyla süsleyin.',
    ],
    garnish: 'Nane dalı, misket limonu kabuğu',
  },
  'pina-colada': {
    description:
      "Beyaz rom, ananas suyu ve hindistan cevizi kreması, buzla blenderden geçirilir. Porto Riko'nun ulusal içkisi.",
    steps: [
      'Tüm malzemeleri bir bardak buzla pürüzsüz olana kadar blenderden geçirin.',
      'Bir hurricane kadehine dökün.',
    ],
    garnish: 'Ananas dilimi, vişne',
  },
  zombie: {
    description:
      'Misket limonu, ananas, çarkıfelek meyvesi ve nar şurubuyla hazırlanan, yüksek alkollü iki rom karışımı.',
    steps: [
      'Tüm malzemeleri buzla çalkalayın.',
      'Kırık buz üzerine, uzun bir bardaga süzün.',
      'Nane ve bir vişneyle süsleyin.',
    ],
    garnish: 'Nane dalı, vişne',
  },
  painkiller: {
    description:
      "Koyu rom, ananas suyu, portakal suyu ve hindistan cevizi kreması. Britanya Virjin Adaları'nın klasiği.",
    steps: [
      'Tüm malzemeleri buzla çalkalayın.',
      'Kırık buzla dolu bir rocks ya da tiki bardağına dökün.',
      'Rendelenmiş muskatla süsleyin.',
    ],
    garnish: 'Rendelenmiş muskat',
  },
  hurricane: {
    description:
      'Çarkıfelek meyvesi şurubu, portakal ve misket limonuyla hazırlanan iki rom karışımı. New Orleans doğumlu.',
    steps: [
      'Tüm malzemeleri buzla çalkalayın.',
      'Taze buz üzerine, bir hurricane kadehine süzün.',
      'Bir dilim portakal ve vişneyle süsleyin.',
    ],
    garnish: 'Portakal dilimi, vişne',
  },
  'jungle-bird': {
    description:
      "Koyu rom ve Campari; ananas ve misket limonu suyuyla. Kuala Lumpur kökenli modern bir tiki favorisi.",
    steps: [
      'Tüm malzemeleri buzla çalkalayın.',
      'Buz üzerine, bir rocks bardağına süzün.',
      'Bir dilim ananasla süsleyin.',
    ],
    garnish: 'Ananas dilimi',
  },

  // ---- contemporary ----
  'espresso-martini': {
    description: 'Votka, kahve likörü ve taze espresso, köpürene kadar çalkalanır. Modern bir gece yarısı klasiği.',
    steps: [
      'İyice soğuyup köpürünceye kadar tüm malzemeleri buzla çalkalayın.',
      'Soğutulmuş bir coupe ya da martini kadehine çift süzün.',
      'Üç kahve çekirdeğiyle süsleyin.',
    ],
    garnish: 'Üç kahve çekirdeği',
  },
  'aperol-spritz': {
    description:
      "Aperol, prosecco ve bir tutam soda, buz üzerinde. İtalya'nın canlı, acı-portakal aromalı aperatifi.",
    steps: [
      'Bir şarap kadehini buzla doldurun.',
      "Aperol'ü, ardından prosecco'yu ekleyin.",
      'Üzerine bir tutam soda ekleyip hafifçe karıştırın.',
    ],
    garnish: 'Portakal dilimi',
  },
  cosmopolitan: {
    description: "Votka, triple sec, kızılcık ve misket limonu suyu. 1990'ların ikonu.",
    steps: [
      'Tüm malzemeleri buzla çalkalayın.',
      'Soğutulmuş bir martini kadehine süzün.',
      'Bir misket limonu dilimi ya da portakal kabuğuyla süsleyin.',
    ],
    garnish: 'Misket limonu dilimi',
  },
  'white-russian': {
    description: 'Votka ve kahve likörü, buz üzerinde krema ile yüzdürülür.',
    steps: [
      'Bir rocks bardağını buzla doldurun.',
      'Votkayı ve kahve likörünü ekleyip karıştırın.',
      'Kremayı bir kaşığın sırtından dökerek nazıkçe üzerinde yüzdürün.',
    ],
  },
  bramble: {
    description: "Böğürtlen likörüyle süslenen bir cin sour. 1980'lerde Londra'da Dick Bradsell tarafından yaratıldı.",
    steps: [
      'Cini, limon suyunu ve şurubu buzla çalkalayın.',
      'Kırık buzla dolu bir rocks bardağına süzün.',
      'Böğürtlen likörünü üzerine gezdirin, aşağı süzülmesini sağlayın.',
      'Bir böğürtlen ve limon diliyle süsleyin.',
    ],
    garnish: 'Böğürtlen, limon dilimi',
  },
  penicillin: {
    description:
      "Harmanlanmış İskoç viskisi, limon ve ballı zencefil şurubu; üzerinde turbalı İskoç viskisi yüzdürülür. 2005'ten bir modern klasik.",
    steps: [
      'Harmanlanmış İskoç viskisini, limon suyunu ve ballı zencefil şurubunu buzla çalkalayın.',
      'Taze buz üzerine, bir rocks bardağına süzün.',
      'Turbalı İskoç viskisini bir kaşığın üzerinden nazıkçe dökerek yüzdürün.',
      'Şekerlenmiş zencefille süsleyin.',
    ],
    garnish: 'Şekerlenmiş zencefil',
  },

  // ---- alcohol-free ----
  'virgin-mojito': {
    description: 'Rom olmadan misket limonu, nane ve soda. Tüm ferahlık, alkolsüz.',
    steps: [
      'Nane yapraklarını şeker şurubu ve misket limonu suyuyla ezin.',
      'Bardağı buzla doldurun.',
      'Üzerine soda ekleyip karıştırın.',
      'Bir dal nane ile süsleyin.',
    ],
    garnish: 'Nane dalı',
  },
  'shirley-temple': {
    description:
      'Zencefilli gazoz ve nar şurubu, üzerinde bir vişne. Çocuk yıldızın adını taşıyan bir soda-bar klasiği.',
    steps: [
      'Bir bardağı buzla doldurun.',
      'Nar şurubunu ekleyin.',
      'Üzerine zencefilli gazoz ekleyip hafifçe karıştırın.',
      'Bir maraschino vişnesiyle süsleyin.',
    ],
    garnish: 'Maraschino vişnesi',
  },
  'virgin-pina-colada': {
    description: 'Ananas suyu ve hindistan cevizi kreması, buzla blenderden geçirilir.',
    steps: [
      'Tüm malzemeleri bir bardak buzla pürüzsüz olana kadar blenderden geçirin.',
      'Bir hurricane kadehine dökün.',
    ],
    garnish: 'Ananas dilimi',
  },
  'garden-spritz': {
    description: 'Ezilmiş salatalık ve nane; misket limonu ve sodayla. Ferah ve otsu.',
    steps: [
      'Salatalığı ve naneyi misket limonu suyu ve şurupla ezin.',
      'Bardağı buzla doldurun.',
      'Üzerine soda ekleyip hafifçe karıştırın.',
      'Bir salatalık şeridiyle süsleyin.',
    ],
    garnish: 'Salatalık şeridi',
  },
  'ginger-mule-virgin': {
    description: "Misket limonu suyu ve zencefilli bira, buz üzerinde. Moscow Mule'ün alkolsüz yorumu.",
    steps: [
      'Bakır bir kupayı ya da bardağı buzla doldurun.',
      'Misket limonu suyunu ekleyin.',
      'Üzerine zencefilli bira ekleyip hafifçe karıştırın.',
      'Bir misket limonu diliyle süsleyin.',
    ],
    garnish: 'Misket limonu dilimi',
  },

  // ---- additions ----
  'bloody-mary': {
    description:
      'Votka ve domates suyu; limon suyu, Worcestershire sosu, acı sos ve bir tutam bitterle tatlandırılır. Klasik bir brunch içkisi.',
    steps: [
      'Bir highball bardağını buzla doldurun.',
      'Votkayı, domates suyunu ve limon suyunu ekleyin.',
      'Worcestershire sosu, acı sos ve bir tutam bitterle tatlandırın.',
      'Hafifçe karıştırın ve bir sap kereviz ile süsleyin.',
    ],
    garnish: 'Sap kereviz, limon dilimi',
  },
  screwdriver: {
    description: 'Votka ve portakal suyu, buz üzerinde. Bir kokteylin alabileceği en basit hâl.',
    steps: [
      'Bir highball bardağını buzla doldurun.',
      'Votkayı ekleyin.',
      'Üzerine portakal suyu ekleyip hafifçe karıştırın.',
    ],
    garnish: 'Portakal dilimi',
  },
  'black-russian': {
    description: 'Votka ve kahve likörü, buz üzerinde. Zengin, sert ve fazlasıyla yalın.',
    steps: [
      'Bir rocks bardağını buzla doldurun.',
      'Votkayı ve kahve likörünü ekleyin.',
      'Kısaca karıştırın.',
    ],
  },
  kamikaze: {
    description:
      'Eşit oranda votka, triple sec ve misket limonu suyu, sertçe çalkalanıp süzülür. Bar kültürünün klasikleşmiş ekşi shot\'ı.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir shot bardağına ya da coupe kadehine süzün.'],
  },
  'vodka-tonic': {
    description: 'Votka ve tonik, buz üzerinde, bir sıkım misket limonuyla. Sade ve temiz bir highball.',
    steps: [
      'Bir highball bardağını buzla doldurun.',
      'Votkayı ekleyin.',
      'Üzerine tonik ekleyip hafifçe karıştırın.',
    ],
    garnish: 'Misket limonu dilimi',
  },
  'gold-rush': {
    description:
      'Bourbon, bal şurubu ve limon suyu, çalkalanıp buz üzerine süzülür. Whiskey Sour ile aynı temele sahip modern bir klasik.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Taze buz üzerine, bir rocks bardağına süzün.'],
  },
  'blood-and-sand': {
    description:
      'Eşit oranda İskoç viskisi, vişne likörü, tatlı vermut ve portakal suyu, birlikte çalkalanır. Adını 1922 yapımı bir boğa güreşi filminden alır.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  'whiskey-smash': {
    description:
      'Nane ve limon suyuyla ezilen bourbon, çalkalanıp kırık buz üzerine süzülür. Whiskey Sour\'un daha ferah bir kuzeni.',
    steps: [
      'Nane yapraklarını limon suyu ve şeker şurubuyla bir shaker\'da ezin.',
      'Bourbonu ve buzu ekleyip iyice çalkalayın.',
      'Kırık buz üzerine, bir rocks bardağına süzün.',
      'Bir nane dalıyla süsleyin.',
    ],
    garnish: 'Nane dalı',
  },
  'new-york-sour': {
    description:
      'Üzerine sek kırmızı şarap yüzdürülen bir Whiskey Sour; şarap koyu bir katman hâlinde üstte kalır.',
    steps: [
      'Çavdar viskisini, limon suyunu ve şeker şurubunu buzla çalkalayın.',
      'Taze buz üzerine, bir rocks bardağına süzün.',
      'Kırmızı şarabı bir kaşığın üzerinden nazıkçe dökerek yüzdürün.',
    ],
  },
  algonquin: {
    description:
      "Çavdar viskisi, sek vermut ve ananas suyu, çalkalanıp süzülür. New York'taki Algonquin Otel'inden adını alır.",
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  'el-presidente': {
    description:
      "Altın rom, sek vermut, triple sec ve bir tutam nar şurubu, karıştırılıp süzülür. 1920'lerden kalma bir Küba klasiği.",
    steps: [
      'Tüm malzemeleri buzla birlikte bir karıştırma bardağına ekleyin.',
      'İyice soğuyana kadar karıştırın.',
      'Soğutulmuş bir coupe kadehine süzün.',
    ],
  },
  'dark-daiquiri': {
    description:
      'Beyaz rom yerine koyu romla yapılan bir Daiquiri — koyu rom, misket limonu suyu ve şeker şurubu, buz gibi olana kadar çalkalanır.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  'rum-sour': {
    description: 'Altın rom, limon suyu ve şeker şurubu, çalkalanıp birkaç damla bitterle tamamlanır.',
    steps: [
      'Romu, limon suyunu ve şurubu buzla çalkalayın.',
      'Taze buz üzerine, bir rocks bardağına süzün.',
      'Üzerine birkaç damla bitter dökerek süsleyin.',
    ],
  },
  'tommys-margarita': {
    description:
      "Blanco tekila, misket limonu suyu ve agave şurubu — San Francisco'daki Tommy's Mexican Restaurant'tan gelen, triple sec yerine agave kullanan bir Margarita varyasyonu.",
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Taze buz üzerine, bir rocks bardağına süzün.'],
  },
  'tequila-sunrise': {
    description:
      'Tekila ve portakal suyu buz üzerinde hazırlanır; en son eklenen nar şurubu dibe çökerek içeceğin içinde bir gündoğumu görüntüsü oluşturana kadar yükselir.',
    steps: [
      'Bir highball bardağını buzla doldurun, tekilayı ve portakal suyunu ekleyin.',
      'Kısaca karıştırın.',
      'Nar şurubunu yavaşça dökerek dibe çökmesini sağlayın.',
      'Bir dilim portakal ve bir vişneyle süsleyin.',
    ],
    garnish: 'Portakal dilimi, vişne',
  },
  'el-diablo': {
    description:
      'Tekila, frenk üzümü likörü ve misket limonu suyu, üzerine zencefilli bira eklenir. Ekşi, meyvemsi ve köpüklü.',
    steps: [
      'Bir highball bardağını ya da bakır kupayı buzla doldurun.',
      'Tekilayı, frenk üzümü likörünü ve misket limonu suyunu ekleyin.',
      'Üzerine zencefilli bira ekleyip hafifçe karıştırın.',
      'Bir misket limonu diliyle süsleyin.',
    ],
    garnish: 'Misket limonu dilimi',
  },
  'mexican-mule': {
    description: "Votka yerine tekilayla yapılan bir Moscow Mule — tekila ve misket limonu suyu, üzerine zencefilli bira eklenir.",
    steps: [
      'Bakır bir kupayı ya da bardağı buzla doldurun.',
      'Tekilayı ve misket limonu suyunu ekleyin.',
      'Üzerine zencefilli bira ekleyip hafifçe karıştırın.',
    ],
  },
  'japanese-cocktail': {
    description:
      "Konyak, orgeat ve bitter, iyice soğuyana kadar karıştırılır. Jerry Thomas'ın 1862 tarihli barmenlik kitabına dayanan, kayıtlardaki en eski kokteyllerden biri.",
    steps: [
      'Tüm malzemeleri buzla birlikte bir karıştırma bardağına ekleyin.',
      'İyice soğuyana kadar karıştırın.',
      'Soğutulmuş bir coupe kadehine süzün.',
    ],
    garnish: 'Limon kabuğu',
  },
  stinger: {
    description: 'Konyak ve beyaz nane likörü, buzla karıştırılır. Serin, sert ve tam anlamıyla eski usul.',
    steps: [
      'Konyağı ve nane likörünü buzla bir karıştırma bardağına ekleyin.',
      'İyice soğuyana kadar karıştırın.',
      'Soğutulmuş bir coupe kadehine ya da buz üzerine bir rocks bardağına süzün.',
    ],
  },
  'brandy-sour': {
    description: 'Konyak, limon suyu ve şeker şurubu, çalkalanıp birkaç damla bitterle tamamlanır.',
    steps: [
      'Konyağı, limon suyunu ve şurubu buzla çalkalayın.',
      'Taze buz üzerine, bir rocks bardağına süzün.',
      'Üzerine birkaç damla bitter dökerek süsleyin.',
    ],
  },
  'mezcal-margarita': {
    description:
      'Tekila yerine mezcalle yapılan, daha dumanlı bir Margarita — mezcal, triple sec ve misket limonu suyu, sertçe çalkalanır.',
    steps: [
      'Dilerseniz bir rocks bardağının kenarını tuzlayın.',
      'Tüm malzemeleri buzla çalkalayın.',
      'Taze buz üzerine, bardağa süzün.',
    ],
    garnish: 'Misket limonu dilimi',
  },
  'oaxaca-old-fashioned': {
    description:
      "Blanco tekila ve mezcal; agave şurubuyla tatlandırılıp bitterle baharatlanır, buzla karıştırılır. 2000'lerde barmen Phil Ward tarafından yaratıldı.",
    steps: [
      'Tüm malzemeleri buzla birlikte bir karıştırma bardağına ekleyin.',
      'İyice soğuyana kadar karıştırın.',
      'Büyük bir buz küpü üzerine, bir rocks bardağına süzün.',
      'Bir portakal kabuğunu üzerine sıkarak yağını çıkarın ve bardağa bırakın.',
    ],
    garnish: 'Portakal kabuğu',
  },
  mimosa: {
    description: 'Eşit oranda soğuk şampanya ve portakal suyu, doğrudan kadehte hazırlanır. Klasik bir brunch içkisi.',
    steps: [
      'Portakal suyunu soğutulmuş bir şampanya flüt kadehine dökün.',
      'Üzerine şampanya ekleyip çok hafifçe karıştırın.',
    ],
  },
  bellini: {
    description: "Prosecco ve beyaz şeftali püresi, nazikçe birleştirilir. Venedik'teki Harry's Bar'da icat edildi.",
    steps: [
      'Şeftali nektarını soğutulmuş bir şampanya flüt kadehine ekleyin.',
      'Üzerine prosecco ekleyip çok hafifçe karıştırın.',
    ],
  },
  'wine-spritzer': {
    description: 'Sek beyaz şarap, buz üzerinde sodayla uzatılır. Hafif, düşük alkollü bir ferahlatıcı.',
    steps: [
      'Bir şarap kadehini buzla doldurun.',
      'Beyaz şarabı ekleyin.',
      'Üzerine soda ekleyip hafifçe karıştırın.',
    ],
    garnish: 'Limon dilimi',
  },
  shandy: {
    description: 'Bira ve limonata, eşit oranlarda. Düşük alkollü, kolay içilen bir pub klasiği.',
    steps: [
      'Birayı bir pint bardağına dökün.',
      'Üzerine limonata ekleyip hafifçe karıştırın.',
    ],
  },
  'black-velvet': {
    description:
      "Stout bira ve şampanya, eşit oranlarda dökülüp nazikçe katmanlanır. 1860'lara dayandığı söylenen, zengin ve kutlamalık bir eşleşme.",
    steps: [
      'Stout birayı soğutulmuş bir flüt kadehine ya da şarap kadehine yarısına kadar dökün.',
      'Üzerine şampanyayı bir kaşığın üzerinden nazıkçe dökerek katmanlayın.',
    ],
  },
  bicicletta: {
    description:
      "Campari, sek beyaz şarap ve bir tutam sodayla uzatılır. Kuzey İtalya'da popüler, bir Americano'nun daha hafif ve düşük alkollü hâli.",
    steps: [
      'Bir şarap kadehini buzla doldurun.',
      "Campari'yi ve beyaz şarabı ekleyin.",
      'Üzerine bir tutam soda ekleyip hafifçe karıştırın.',
      'Bir dilim portakalla süsleyin.',
    ],
    garnish: 'Portakal dilimi',
  },
  'virgin-mary': {
    description: 'Votkasız bir Bloody Mary — domates suyu, limon suyu, Worcestershire sosu ve acı sosla tatlandırılır.',
    steps: [
      'Bir highball bardağını buzla doldurun.',
      'Domates suyunu ve limon suyunu ekleyin.',
      'Worcestershire sosu ve acı sosla tatlandırıp karıştırın.',
      'Bir sap kereviz ile süsleyin.',
    ],
    garnish: 'Sap kereviz, limon dilimi',
  },
  'arnold-palmer': {
    description: 'Eşit oranda soğuk çay ve limonata; adını bu karışımı popülerleştiren golfçüden alır.',
    steps: [
      'Bir highball bardağını buzla doldurun.',
      'Soğuk çayı ve limonatayı ekleyin.',
      'Hafifçe karıştırın.',
    ],
    garnish: 'Limon dilimi',
  },
  'virgin-paloma': {
    description: "Paloma'nın alkolsüz yorumu — greyfurt suyu ve misket limonu suyu, üzerine soda eklenir.",
    steps: [
      'Dilerseniz bir highball bardağının kenarını tuzlayın.',
      'Buzla doldurun, greyfurt suyunu ve misket limonu suyunu ekleyin.',
      'Üzerine soda ekleyip hafifçe karıştırın.',
    ],
    garnish: 'Greyfurt dilimi',
  },
  'whisky-highball': {
    description: 'İskoç viskisi, buz üzerinde soğuk sodayla uzatılır. Sade, tok ve içmesi hiç bitmeyen bir içki.',
    steps: [
      'Bir highball bardağını buzla doldurun.',
      'Viskiyi ekleyin.',
      'Üzerine soda ekleyip hafifçe karıştırın.',
    ],
  },
  'horses-neck': {
    description:
      "Konyak üzerine zencefilli gazoz eklenir; geleneksel olarak bardağın kenarından sarkan uzun bir limon kabuğu spiraliyle süslenir.",
    steps: [
      'Bir collins bardağının içine uzun bir limon kabuğu spirali asın.',
      'Bardağı buzla doldurun ve konyağı ekleyin.',
      'Üzerine zencefilli gazoz ekleyip hafifçe karıştırın.',
    ],
    garnish: 'Uzun limon kabuğu spirali',
  },
  'amaretto-sour': {
    description: 'Amaretto, limon suyu ve şeker şurubu, köpürene kadar çalkalanır. Cevizsi, ekşi ve kolay içilir.',
    steps: [
      'Yumurta akı kullanıyorsanız, tüm malzemeleri buzsuz sertçe çalkalayarak emülsiye edin.',
      'Buz ekleyip tekrar iyice soğuyana kadar çalkalayın.',
      'Taze buz üzerine, bir rocks bardağına süzün.',
      'Dilerseniz üzerine birkaç damla bitter dökerek süsleyin.',
    ],
  },
  'naked-and-famous': {
    description:
      "Eşit oranda mezcal, sarı Chartreuse, Aperol ve misket limonu suyu, sertçe çalkalanır. New York'taki Death & Co'dan gelen, tanınmış bir 21. yüzyıl modern klasiği.",
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  greyhound: {
    description: "Votka ve greyfurt suyu, buz üzerinde. Salty Dog'un tuz kenarsız hâli.",
    steps: [
      'Bir highball bardağını buzla doldurun.',
      'Votkayı ve greyfurt suyunu ekleyin.',
      'Hafifçe karıştırın.',
    ],
  },
  'planters-punch': {
    description:
      'Koyu rom, misket limonu suyu, şeker şurubu, portakal suyu ve bir tutam bitter, kırık buz üzerine çalkalanır. "Bir ekşi, iki tatlı, üç sert, dört hafif" eski tekerlemesine dayanan bir Karayip punçu.',
    steps: [
      'Tüm malzemeleri buzla çalkalayın.',
      'Kırık buz üzerine, bir hurricane kadehine süzün.',
      'Bir dilim portakal, bir vişne ve bir nane dalıyla süsleyin.',
    ],
    garnish: 'Portakal dilimi, vişne, nane dalı',
  },

  // ---- additions2 (gin, vodka, whiskey, rum) ----
  'corpse-reviver-no-1': {
    description: 'Konyak, elma brendisi ve tatlı vermut, ipeksi olana kadar karıştırılır. Daha ünlü cinli kardeşinden önce gelen, ısıtıcı bir "ertesi gün" klasiği.',
    steps: ['Tüm malzemeleri buzla birlikte bir karıştırma bardağına ekleyin.', 'İyice soğuyana kadar karıştırın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  'pink-lady': {
    description: 'Cin, elma brendisi, nar şurubu, limon suyu ve yumurta akı, soluk pembe ve köpüklü olana kadar çalkalanır. Caz Çağı’nın klasiklerinden.',
    steps: [
      'Yumurta akını emülsifiye etmek için tüm malzemeleri buzsuz çalkalayın.',
      'Buz ekleyip iyice soğuyana kadar tekrar çalkalayın.',
      'Soğutulmuş bir coupe kadehine süzün.',
    ],
  },
  'singapore-sling': {
    description: 'Cin, kiraz likörü, Bénédictine, triple sec, misket limonu, ananas ve bitter, sodayla tamamlanır. Raffles Hotel’de yaratılan katmanlı, meyveli bir klasik.',
    steps: [
      'Soda hariç tüm malzemeleri buzla çalkalayın.',
      'Taze buz üzerine bir hurricane kadehine süzün.',
      'Sodayla tamamlayın ve hafifçe karıştırın.',
      'Bir dilim ananas ve bir vişneyle süsleyin.',
    ],
    garnish: 'Ananas dilimi, vişne',
  },
  'ramos-gin-fizz': {
    description: 'Cin, narenciye, krema, yumurta akı ve bir damla turunç çiçeği suyu, uzun uzun çalkalanıp sodayla tamamlanır. Hazırlaması meşakkatli olmasıyla ünlü bir New Orleans klasiği.',
    steps: [
      'Soda hariç tüm malzemeleri en az bir dakika boyunca buzsuz çalkalayarak emülsifiye edin.',
      'Buz ekleyip iyice soğuyana kadar bir iki dakika daha sert çalkalayın.',
      'Soğutulmuş bir collins bardağına süzün.',
      'Köpüğü tamamlamak için bir tutam soda ekleyin.',
    ],
  },
  'white-lady': {
    description: 'Cin, triple sec ve limon suyu, yumurta akıyla köpüklü olana kadar çalkalanır. Sidecar’ın keskin, narenciye ağırlıklı bir akrabası.',
    steps: ['Tüm malzemeleri buzla sert şekilde çalkalayın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  'negroni-sbagliato': {
    description: 'Eşit oranda Campari ve tatlı vermut, cin yerine prosecco ile tamamlanır — daha hafif, daha köpüklü bir "yanlış" Negroni.',
    steps: [
      'Bir rocks ya da şarap kadehini buzla doldurun.',
      'Campari ve tatlı vermutu ekleyip kısaca karıştırın.',
      'Prosecco ile tamamlayın ve hafifçe karıştırın.',
      'Bir dilim portakalla süsleyin.',
    ],
    garnish: 'Portakal dilimi',
  },
  'gin-rickey': {
    description: 'Cin, taze misket limonu suyu ve soda, buz üzerinde — hiç şeker yok. Kayıtlardaki en sek, en eski highball’lerden biri.',
    steps: ['Bir highball bardağını buzla doldurun.', 'Cin ve misket limonu suyunu ekleyin.', 'Sodayla tamamlayın ve hafifçe karıştırın.'],
  },
  'monkey-gland': {
    description: 'Cin, portakal suyu, nar şurubu ve bir tutam absinthle çalkalanır. Tuhaf isimli, sevilen bir 1920’ler Harry’s Bar orijinali.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  'alaska-cocktail': {
    description: 'Cin ve sarı Chartreuse, portakal bitteriyle karıştırılır. Tropik çağrıştıran isme rağmen içki ağırlıklı bir klasik — Alaska ile ilgisi soğukluğundan ibaret.',
    steps: ['Tüm malzemeleri buzla birlikte bir karıştırma bardağına ekleyin.', 'İyice soğuyana kadar karıştırın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  'bronx-cocktail': {
    description: 'Cin, sek ve tatlı vermut, portakal suyuyla çalkalanır. 1900’lerin başında son derece yaygın olan, New York’un semtinden adını alan bir klasik.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  'pegu-club': {
    description: 'Cin, triple sec, misket limonu suyu ve iki tür bitter, sert şekilde çalkalanır. Rangoon’daki bir İngiliz sömürge subayları kulübünün adını taşır.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  'john-collins': {
    description: 'Genever, limon suyu ve şeker, buz üzerine soda ile tamamlanır. Tom Collins’in aynı garsondan adını alan, daha maltlı ve daha eski kuzeni.',
    steps: [
      'Genever, limon suyu ve şurubu buzla çalkalayın.',
      'Taze buz üzerine bir collins bardağına süzün.',
      'Sodayla tamamlayın ve hafifçe karıştırın.',
    ],
  },
  'gin-daisy': {
    description: 'Cin, limon suyu, nar şurubu ve triple sec, çalkalanıp sodayla tamamlanır. Modern ekşi kokteylden önce gelen, ekşi-tatlı ve hafif güçlendirilmiş 19. yüzyıl formatı.',
    steps: [
      'Cin, limon suyu, nar şurubu ve triple sec’i buzla çalkalayın.',
      'Taze buz üzerine bir rocks bardağına süzün.',
      'Bir tutam soda ile tamamlayın.',
    ],
  },
  'blue-moon-cocktail': {
    description: 'Cin, menekşe likörü ve limon suyu, soluk lavanta rengi alana kadar çalkalanır. Aviation’ın narin bir vintage kız kardeşi.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  'sex-on-the-beach': {
    description: 'Votka ve şeftali likörü, portakal ve kızılcık suyuyla. Tatlı, meyveli ve 1980’lerden beri sonsuz popüler bir bar klasiği.',
    steps: ['Bir highball bardağını buzla doldurun.', 'Tüm malzemeleri ekleyin.', 'Hafifçe karıştırın.'],
  },
  'blue-lagoon': {
    description: 'Votka ve mavi curaçao, limonatayla tamamlanır. Parlak mavi, tatlı ve basit.',
    steps: ['Bir highball bardağını buzla doldurun.', 'Votka ve mavi curaçaoyu ekleyin.', 'Limonatayla tamamlayın ve hafifçe karıştırın.'],
    garnish: 'Portakal dilimi, vişne',
  },
  'harvey-wallbanger': {
    description: 'Üzerine vanilya likörü (Galliano tarzı) yüzdürülmüş bir Screwdriver. Retro bir 1970’ler klasiği.',
    steps: [
      'Bir highball bardağını buzla doldurun.',
      'Votka ve portakal suyunu ekleyip karıştırın.',
      'Vanilya likörünü bir kaşığın sırtından dökerek üzerine yüzdürün.',
    ],
  },
  caesar: {
    description: 'Votka ve Clamato suyu, acı sos ve Worcestershire ile tatlandırılıp tuz kenarlı bir bardakta buz üzerinde servis edilir. Kanada’nın ulusal brunch kokteyli.',
    steps: [
      'İsteğe bağlı olarak bir highball bardağının kenarını deniz tuzuyla tuzlayın ve buzla doldurun.',
      'Votka, Clamato suyu ve misket limonu suyunu ekleyin.',
      'Acı sos ve Worcestershire sosuyla tatlandırıp karıştırın.',
      'Bir sap kerevizle süsleyin.',
    ],
    garnish: 'Kereviz sapı, misket limonu dilimi',
  },
  'chi-chi': {
    description: 'Rom yerine votkayla yapılan bir Piña Colada — votka, ananas suyu ve hindistan cevizi kreması, buzla blenderdan geçirilir.',
    steps: ['Tüm malzemeleri bir bardak buzla blendera ekleyin.', 'Pürüzsüz olana kadar karıştırın.', 'Bir hurricane kadehine dökün.'],
    garnish: 'Ananas dilimi',
  },
  'vodka-gimlet': {
    description: 'Cin yerine votkayla yapılan bir Gimlet — votka, misket limonu suyu ve şeker şurubu, buz gibi olana kadar çalkalanır.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  'bloody-maria': {
    description: 'Votka yerine tekilayla yapılan bir Bloody Mary — domates suyu, misket limonu ve acı sos, buz üzerinde.',
    steps: [
      'Bir highball bardağını buzla doldurun.',
      'Tekila, domates suyu ve misket limonu suyunu ekleyin.',
      'Acı sos ve Worcestershire sosuyla tatlandırıp karıştırın.',
      'Bir misket limonu dilimiyle süsleyin.',
    ],
    garnish: 'Misket limonu dilimi',
  },
  'salty-chihuahua': {
    description: 'Votka yerine tekilayla yapılan bir Salty Dog — tekila ve greyfurt suyu, tuz kenarlı bir bardakta buz üzerinde.',
    steps: [
      'İsteğe bağlı olarak bir highball bardağının kenarını deniz tuzuyla tuzlayın ve buzla doldurun.',
      'Tekila ve greyfurt suyunu ekleyin.',
      'Hafifçe karıştırın.',
    ],
  },
  'kentucky-mule': {
    description: 'Votka yerine bourbonla yapılan bir Moscow Mule — bourbon ve misket limonu suyu, zencefilli birayla tamamlanır.',
    steps: ['Bir bakır bardağı buzla doldurun.', 'Bourbon ve misket limonu suyunu ekleyin.', 'Zencefilli birayla tamamlayın ve hafifçe karıştırın.'],
    garnish: 'Misket limonu dilimi, nane dalı',
  },
  'brown-derby': {
    description: 'Bourbon, taze greyfurt suyu ve bal şurubu, çalkalanıp süzülür. Şapka şeklindeki Hollywood restoranından adını alır.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir coupe ya da rocks bardağına süzün.'],
  },
  'seelbach-cocktail': {
    description: 'Bourbon, triple sec ve iki tür bitter, şampanyayla tamamlanır. Louisville’ın Seelbach Hotel’inde tesadüfen keşfedildiği söylenir.',
    steps: [
      'Bourbon, triple sec ve her iki bitteri bir şampanya kadehine ekleyin.',
      'Kısaca karıştırın.',
      'Yavaşça şampanyayla tamamlayın.',
      'Bir portakal kabuğuyla süsleyin.',
    ],
    garnish: 'Portakal kabuğu',
  },
  presbyterian: {
    description: 'Viski, eşit oranda zencefilli gazoz ve sodayla uzatılır. "Press" olarak da bilinen hafif, kolay içilen bir highball.',
    steps: ['Bir highball bardağını buzla doldurun.', 'Bourbonu ekleyin.', 'Zencefilli gazoz ve sodayla tamamlayıp hafifçe karıştırın.'],
  },
  'waldorf-cocktail': {
    description: 'Çavdar viskisi ve tatlı vermut, absinth ve bitterle karıştırılır. New York otelinden adını alan, içki ağırlıklı bir Prohibition öncesi klasik.',
    steps: ['Tüm malzemeleri buzla birlikte bir karıştırma bardağına ekleyin.', 'İyice soğuyana kadar karıştırın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  'widows-kiss': {
    description: 'Elma brendisi, sarı Chartreuse ve Bénédictine, bitterle karıştırılır. Zengin, otsu, meyve bahçesi ağırlıklı bir 19. yüzyıl klasiği.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  'preakness-cocktail': {
    description: 'Çavdar viskisi ve tatlı vermut, bir tutam Bénédictine ve bitterle. At yarışından adını alır, Manhattan ile aynı ailededir.',
    steps: ['Tüm malzemeleri buzla birlikte bir karıştırma bardağına ekleyin.', 'İyice soğuyana kadar karıştırın.', 'Soğutulmuş bir coupe ya da rocks bardağına süzün.'],
  },
  'remember-the-maine': {
    description: 'Çavdar viskisi, tatlı vermut, kiraz likörü ve bir absinth durulaması. Charles H. Baker’ın yarattığı, kirazlı ve sert bir Manhattan yorumu.',
    steps: ['Tüm malzemeleri buzla birlikte bir karıştırma bardağına ekleyin.', 'İyice soğuyana kadar karıştırın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  'old-pal': {
    description: 'Çavdar viskisi, Campari ve sek vermut eşit oranda. Boulevardier ve Negroni’nin daha sek, viski bazlı kuzeni.',
    steps: ['Tüm malzemeleri buzla birlikte bir karıştırma bardağına ekleyin.', 'İyice soğuyana kadar karıştırın.', 'Soğutulmuş bir coupe ya da rocks bardağına süzün.'],
  },
  'toronto-cocktail': {
    description: 'Çavdar viskisi, bir tutam acılık için Fernet ve demerara şurubu, bitterle karıştırılır. Old Fashioned’ın Kanadalı yorumu.',
    steps: ['Tüm malzemeleri buzla birlikte bir karıştırma bardağına ekleyin.', 'İyice soğuyana kadar karıştırın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  scofflaw: {
    description: 'Çavdar viskisi, sek vermut, limon suyu, nar şurubu ve portakal bitteri. Parisli bir barda Amerikalı göçmenler için yaratılan bir Prohibition dönemi klasiği.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  'kentucky-buck': {
    description: 'Bourbon, limon suyu ve demerara şurubu, zencefilli birayla tamamlanıp birkaç damla bitterle bitirilir. Brunch’a uygun modern bir bourbon highball.',
    steps: [
      'Bourbon, limon suyu ve demerara şurubunu buzla çalkalayın.',
      'Taze buz üzerine bir highball bardağına süzün.',
      'Zencefilli birayla tamamlayın ve hafifçe karıştırın.',
      'Üzerine birkaç damla bitter damlatarak süsleyin.',
    ],
  },
  'black-manhattan': {
    description: 'Tatlı vermut yerine tatlı-acı bir amaro ile yapılan bir Manhattan. 2000’lerin zanaat kokteyl canlanmasından tanınan bir modern klasik.',
    steps: ['Tüm malzemeleri buzla birlikte bir karıştırma bardağına ekleyin.', 'İyice soğuyana kadar karıştırın.', 'Soğutulmuş bir coupe kadehine süzün.'],
    garnish: 'Vişne',
  },
  'improved-whiskey-cocktail': {
    description: 'Çavdar viskisi, maraschino likörü ve şeker, bitter ve bir absinth durulamasıyla karıştırılır. Jerry Thomas’ın orijinal viski kokteylini geliştirdiği 19. yüzyıl versiyonu.',
    steps: [
      'Soğutulmuş bir coupe kadehini absinthle durulayın ve fazlasını dökün.',
      'Viski, maraschino, şurup ve bitteri buzla karıştırın.',
      'Hazırladığınız kadehe süzün.',
    ],
    garnish: 'Limon kabuğu',
  },
  tipperary: {
    description: 'İrlanda viskisi, tatlı vermut ve yeşil Chartreuse eşit oranda. İrlanda’nın bir ilçesinden adını alan, zengin ve otsu bir 1900’ler başı klasiği.',
    steps: ['Tüm malzemeleri buzla birlikte bir karıştırma bardağına ekleyin.', 'İyice soğuyana kadar karıştırın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  'louisville-lemonade': {
    description: 'Bourbon, triple sec, limon suyu ve bir tutam kızılcık suyu, buzla çalkalanır. Bourbon diyarından meyveli bir modern bourbon ekşisi.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Taze buz üzerine bir rocks bardağına süzün.'],
    garnish: 'Limon dilimi',
  },
  "corn-n-oil": {
    description: 'Koyu rom ve falernum, buz üzerinde, bitter ve misket limonuyla tatlandırılır. Barbados’tan gelen, melas kadar koyu, yavaş yudumlanan bir Karayip klasiği.',
    steps: [
      'Bir rocks bardağını buzla doldurun.',
      'Falernum ve misket limonu suyunu ekleyin.',
      'Koyu romu üzerine yüzdürün ve bitteri ekleyin.',
      'İçmeden önce kısaca karıştırın.',
    ],
  },
  'rum-swizzle': {
    description: 'Altın rom, misket limonu suyu ve demerara şurubu, kırık buz üzerinde birkaç damla bitterle swizzle edilir. Bermuda’nın gayri resmi ulusal içkisi.',
    steps: [
      'Bir collins bardağını kırık buzla doldurun.',
      'Rom, misket limonu suyu, demerara şurubu ve bitteri ekleyin.',
      'Bir bar kaşığını avuçlarınız arasında hızlıca döndürerek bardak buğulanana kadar swizzle edin.',
      'Bir tutam soda ile tamamlayın.',
    ],
  },
  'bacardi-cocktail': {
    description: 'Beyaz rom, misket limonu suyu ve nar şurubu, çalkalanıp süzülür. Aslında pembemsi bir Daiquiri — bazı yerlerde yasal olarak özellikle Bacardi romuyla yapılması şart koşulmuştu.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  'queens-park-swizzle': {
    description: 'Koyu rom, misket limonu, demerara şurubu ve bol nane ile swizzle edilip üzerine bitter yüzdürülür. Port of Spain’daki bir otelin adını taşıyan Trinidad klasiği.',
    steps: [
      'Naneyi misket limonu suyu ve demerara şurubuyla bir collins bardağında hafifçe ezin.',
      'Kırık buzla doldurup romu ekleyin.',
      'Bir bar kaşığını avuçlarınız arasında hızlıca döndürerek bardak buğulanana kadar swizzle edin.',
      'Üzerine bitteri yüzdürün ve bir nane dalıyla süsleyin.',
    ],
    garnish: 'Nane dalı',
  },
  'scorpion-bowl': {
    description: 'Rom, brendi, portakal suyu, misket limonu suyu ve orgeat, sert şekilde çalkalanır. Geleneksel olarak pipetlerle ortak bir kâsede servis edilen bir tiki bar paylaşım klasiği.',
    steps: ['Tüm malzemeleri buzla sert şekilde çalkalayın.', 'Kırık buz üzerine bir hurricane kadehine süzün.', 'Bir orkide ya da nane dalıyla süsleyin.'],
    garnish: 'Nane dalı',
  },
  'fog-cutter': {
    description: 'Rom, brendi ve cin, portakal, misket limonu ve orgeatla çalkalanıp üzerine sherry yüzdürülür. Trader Vic’in en ünlü — ve en sert — tiki yaratımlarından biri.',
    steps: [
      'Sherry hariç tüm malzemeleri buzla çalkalayın.',
      'Taze buz üzerine bir hurricane kadehine süzün.',
      'Üzerine sherry’i yüzdürün.',
    ],
  },
  'navy-grog': {
    description: 'Yüksek dereceli ve koyu rom, bal şurubu, misket limonu ve greyfurt suyuyla. Güçlü, narenciye ağırlıklı bir Trader Vic’s tiki klasiği.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Kırık buz üzerine bir tiki bardağına süzün.'],
    garnish: 'Nane dalı',
  },
  "missionarys-downfall": {
    description: 'Beyaz rom, şeftali likörü, nane, misket limonu ve ananas, köpüklü olana kadar blenderdan geçirilir. Don the Beachcomber’dan ferahlatıcı bir blend tiki klasiği.',
    steps: ['Tüm malzemeleri bir bardak kırık buzla blendera ekleyin.', 'Pürüzsüz olana kadar karıştırın.', 'Bir hurricane kadehine dökün.'],
    garnish: 'Nane dalı',
  },
  'bahama-mama': {
    description: 'Koyu ve hindistan cevizi romu, kahve likörü, ananas, portakal suyu ve nar şurubuyla. Tatlı, tropikal bir tatil bar klasiği.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Taze buz üzerine bir hurricane kadehine süzün.'],
    garnish: 'Ananas dilimi, vişne',
  },
  'rum-old-fashioned': {
    description: 'Viski yerine koyu romla yapılan bir Old Fashioned — koyu rom, demerara şurubu ve bitter, buz üzerinde karıştırılır.',
    steps: [
      'Tüm malzemeleri buzla birlikte bir karıştırma bardağına ekleyin.',
      'İyice soğuyana kadar karıştırın.',
      'Büyük bir buz küpü üzerine bir rocks bardağına süzün.',
      'Bir portakal kabuğunu üzerine sıkarak yağını çıkarın ve bardağa bırakın.',
    ],
    garnish: 'Portakal kabuğu',
  },

  // ---- additions3 (tekila/mezcal, brendi, şarap/köpüklü/bira, likör ağırlıklı, tiki, alkolsüz) ----
  matador: {
    description: 'Tekila, ananas suyu ve misket limonu suyu, birlikte çalkalanır. Basit, tropikal, yüzyıl ortası bir tekila klasiği.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Taze buz üzerine bir rocks ya da collins bardağına süzün.'],
  },
  batanga: {
    description: 'Tekila, misket limonu suyu ve kola, tuz kenarlı bir bardakta buz üzerinde, geleneksel olarak bir bar bıçağıyla karıştırılır. Jalisco’daki Tequila kasabasında bir yol kenarı barında icat edilmiştir.',
    steps: ['Bir highball bardağının kenarını tuzlayın ve buzla doldurun.', 'Tekila ve misket limonu suyunu ekleyin.', 'Kolayla tamamlayıp iyice karıştırın.'],
    garnish: 'Misket limonu dilimi',
  },
  'mexican-firing-squad': {
    description: 'Tekila, misket limonu suyu, nar şurubu ve bitter, sert şekilde çalkalanır. Mexico City’de belgelenen bir Prohibition dönemi klasiği.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Taze buz üzerine bir rocks bardağına süzün.'],
  },
  'paloma-highball': {
    description: 'Greyfurt suyu ve soda yerine greyfurtlu gazoz kullanan hızlı bir Paloma yorumu. Blanco tekila ve misket limonu, buz üzerinde, tuz kenarlı.',
    steps: [
      'Bir highball bardağının kenarını tuzlayın ve buzla doldurun.',
      'Tekila ve misket limonu suyunu ekleyin.',
      'Greyfurtlu gazozla tamamlayın ve hafifçe karıştırın.',
    ],
    garnish: 'Misket limonu dilimi',
  },
  'mezcal-negroni': {
    description: 'Cin yerine mezcalle yapılan bir Negroni — eşit oranda mezcal, Campari ve tatlı vermut, klasiğin daha dumanlı bir hâli.',
    steps: [
      'Tüm malzemeleri buzla birlikte bir karıştırma bardağına ekleyin.',
      'İyice soğuyana kadar karıştırın.',
      'Taze buz üzerine bir rocks bardağına süzün.',
      'Bir portakal kabuğuyla süsleyin.',
    ],
    garnish: 'Portakal kabuğu',
  },
  'division-bell': {
    description: 'Mezcal, Aperol, misket limonu suyu ve bir tutam maraschino likörü, sert şekilde çalkalanır. Death & Co’dan dumanlı, tatlı-acı bir 2010’lar modern klasiği.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Taze buz üzerine bir rocks bardağına süzün.'],
    garnish: 'Greyfurt kabuğu',
  },
  conquistador: {
    description: 'Tekila, kahve likörü ve krema, köpüklü olana kadar çalkalanır. Trader Vic’s’in bir orijinali — aslında tekila bazlı bir White Russian.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Taze buz üzerine bir rocks bardağına süzün.'],
  },
  rosita: {
    description: 'Cin yerine tekila üzerine kurulu bir Negroni ailesi kokteyli — tekila, Campari, hem sek hem tatlı vermut, buz üzerinde karıştırılır.',
    steps: ['Tüm malzemeleri buzla birlikte bir karıştırma bardağına ekleyin.', 'İyice soğuyana kadar karıştırın.', 'Taze buz üzerine bir rocks bardağına süzün.'],
    garnish: 'Limon kabuğu',
  },
  'brandy-crusta': {
    description: 'Konyak, portakallı curaçao, limon suyu ve maraschino likörü, kenarı şekerli ve içi tamamen limon kabuğuyla kaplı bir bardakta servis edilir. Sidecar’ın atası sayılan, 1800’lerin ortasından bir New Orleans klasiği.',
    steps: [
      'Soğutulmuş bir coupe kadehinin kenarını şekerleyin ve içini uzun bir limon kabuğu spiraliyle kaplayın.',
      'Tüm malzemeleri buzla çalkalayın.',
      'Hazırladığınız kadehe süzün.',
    ],
    garnish: 'Limon kabuğu spirali, şeker kenar',
  },
  'jack-rose': {
    description: 'Elma brendisi, nar şurubu ve misket limonu suyu, gül pembesi olana kadar çalkalanır. Hemingway’de adı geçen bir Prohibition dönemi Amerikan klasiği.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  metropolitan: {
    description: 'Konyak ve tatlı vermut, bir tutam şurup ve bitterle, buz üzerinde karıştırılır. Viski yerine brendi üzerine kurulu bir Prohibition öncesi Manhattan ailesi klasiği.',
    steps: ['Tüm malzemeleri buzla birlikte bir karıştırma bardağına ekleyin.', 'İyice soğuyana kadar karıştırın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  'brandy-fizz': {
    description: 'Konyak, limon suyu ve şeker, çalkalanıp sodayla tamamlanır. Cin yerine brendi üzerine kurulu, sek ve eski format bir fizz.',
    steps: [
      'Konyak, limon suyu ve şurubu buzla çalkalayın.',
      'Taze buz üzerine bir highball bardağına süzün.',
      'Sodayla tamamlayın ve hafifçe karıştırın.',
    ],
  },
  'french-connection': {
    description: 'Konyak ve amaretto, buz üzerinde — başka hiçbir şey yok. Filmden adını alan, basit ve fındıksı bir 1970’ler yemek sonrası içkisi.',
    steps: ['Bir rocks bardağını buzla doldurun.', 'Konyak ve amarettoyu ekleyin.', 'Kısaca karıştırın.'],
  },
  'sherry-flip': {
    description: 'Sherry, bütün bir yumurta ve demerara şurubu, kalın ve kadifemsi olana kadar çalkalanıp üzerine muskat rendelenir. Yüzyıllar öncesine dayanan klasik bir flip formatı.',
    steps: [
      'Tüm malzemeleri iyice karışana kadar buzsuz çalkalayın.',
      'Buz ekleyip iyice soğuyana kadar sert şekilde çalkalayın.',
      'Soğutulmuş bir coupe kadehine süzün.',
      'Üzerine taze muskat rendeleyin.',
    ],
    garnish: 'Rendelenmiş muskat',
  },
  'death-in-the-afternoon': {
    description: 'Üzerine soğuk şampanya dökülen absinth. Ernest Hemingway’e atfedilen, ünlü şekilde sert, iki malzemeli bir içki.',
    steps: ['Absinthi soğutulmuş bir şampanya kadehine dökün.', 'Süt gibi bulanıklaşana kadar yavaşça şampanyayla tamamlayın.'],
  },
  'spritz-veneziano': {
    description: 'Aperol, prosecco ve bir tutam soda, buz üzerinde, bir zeytin ya da portakal diliminle süslenir. Bugünün tüm modern spritzlerinin türediği orijinal şablon.',
    steps: [
      'Bir şarap kadehini buzla doldurun.',
      'Aperol ve proseccoyu ekleyin.',
      'Bir tutam soda ile tamamlayıp hafifçe karıştırın.',
      'Bir dilim portakalla süsleyin.',
    ],
    garnish: 'Portakal dilimi',
  },
  kalimotxo: {
    description: 'Eşit oranda sek kırmızı şarap ve kola, buz üzerinde. Ucuz kırmızı şarabı kolay içilen bir şeye dönüştüren bir Bask öğrenci barı klasiği.',
    steps: ['Bir şarap ya da highball bardağını buzla doldurun.', 'Kırmızı şarap ve kolayı ekleyin.', 'Hafifçe karıştırın.'],
  },
  poinsettia: {
    description: 'Şampanya, kızılcık suyu ve bir tutam triple sec, doğrudan kadehte hazırlanır. Mimosa’nın kırmızıya çalan, bayramlık bir yorumu.',
    steps: ['Kızılcık suyu ve triple seci soğutulmuş bir şampanya kadehine ekleyin.', 'Şampanyayla tamamlayıp çok hafifçe karıştırın.'],
  },
  sangria: {
    description: 'Kırmızı şarap, konyak, portakal suyu ve bir tutam sodayla uzatılır. Paylaşım için tasarlanmış İspanyol şarap punçu klasiği.',
    steps: [
      'Kırmızı şarap, konyak, portakal suyu ve şeker şurubunu buzla bir sürahide birleştirin.',
      'İyice karıştırın ve birkaç dakika soğuması için bekletin.',
      'Bir tutam soda ile tamamlayın.',
      'Dilimlenmiş portakal ve elmayla süsleyerek buz üzerinde servis edin.',
    ],
    garnish: 'Portakal ve elma dilimleri',
  },
  radler: {
    description: 'Greyfurtlu gazozla tamamlanmış bira. Hafif, düşük alkollü bir Alman bisikletçi ferahlatıcısı.',
    steps: ['Birayı bir pint bardağına dökün.', 'Greyfurtlu gazozla tamamlayıp hafifçe karıştırın.'],
  },
  kir: {
    description: 'Bir tutam frenk üzümü likörünün üzerine sek beyaz şarap dökülür. Basit, klasik bir Fransız şarap aperitifi — köpüklü Kir Royale’in durgun şaraplı akrabası.',
    steps: ['Frenk üzümü likörünü soğutulmuş bir şarap kadehine dökün.', 'Beyaz şarapla tamamlayıp hafifçe karıştırın.'],
  },
  'sherry-cobbler': {
    description: 'Sherry, biraz şeker ve portakal, ezilip kırık buz üzerinde çalkalanır. 19. yüzyılın en popüler Amerikan içkilerinden biri.',
    steps: [
      'Sherry, şeker şurubu ve portakal suyunu buzla çalkalayın.',
      'Kırık buzla doldurulmuş bir şarap kadehine süzün.',
      'Taze kiraz ve mevsim meyveleriyle süsleyin.',
    ],
    garnish: 'Taze kiraz, mevsim meyveleri',
  },
  'port-flip': {
    description: 'Porto şarabı, bütün bir yumurta ve bir tutam şurup, kadifemsi olana kadar çalkalanıp muskatla tamamlanır. Zengin, tatlı tarzı bir flip.',
    steps: [
      'Tüm malzemeleri iyice karışana kadar buzsuz çalkalayın.',
      'Buz ekleyip iyice soğuyana kadar sert şekilde çalkalayın.',
      'Soğutulmuş bir coupe kadehine süzün.',
      'Üzerine taze muskat rendeleyin.',
    ],
    garnish: 'Rendelenmiş muskat',
  },
  'moscato-spritz': {
    description: 'Soğutulmuş Moscato, buz üzerinde sodayla uzatılır. Hafif, hafifçe tatlı, düşük alkollü bir içki.',
    steps: [
      'Bir şarap kadehini buzla doldurun.',
      'Moscato’yu ekleyin.',
      'Sodayla tamamlayıp hafifçe karıştırın.',
      'Bir nane dalıyla süsleyin.',
    ],
    garnish: 'Nane dalı',
  },
  grasshopper: {
    description: 'Nane likörü, kakao likörü ve krema, soluk yeşil ve ipeksi olana kadar çalkalanır. Naneli bir 1950’ler tatlı kokteyli.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  'golden-cadillac': {
    description: 'Vanilya likörü, kakao likörü ve krema, köpüklü olana kadar çalkalanır. Grasshopper’ın tatlı, tatlı tarzı bir akrabası.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  'b-52': {
    description: 'Kahve likörü, İrlanda kreması likörü ve portakallı curaçao, yoğunluklarına göre özenle katmanlanarak bir shot bardağına doldurulur. Bilinen bir katmanlı parti shot’ı.',
    steps: [
      'Kahve likörünü bir shot bardağına dökün.',
      'Bir bar kaşığının sırtından dökerek İrlanda kremasını üzerine yavaşça katmanlayın.',
      'Aynı şekilde portakallı curaçaoyu da üzerine yavaşça katmanlayın.',
    ],
  },
  sombrero: {
    description: 'Krema üzerine kahve likörü, buz üzerinde basitçe hazırlanır. Çok kolay, çok tatlı bir yemek sonrası içkisi.',
    steps: ['Bir rocks bardağını buzla doldurun.', 'Kahve likörünü ekleyin.', 'Kremayı üzerine yüzdürüp içmeden önce hafifçe karıştırın.'],
  },
  'pousse-cafe': {
    description: 'Nar şurubu, nane likörü ve konyak, karışmadan yoğunluklarına göre küçük bir bardakta özenle katmanlanır. Viktorya dönemi bir katmanlı içki numarası.',
    steps: [
      'Nar şurubunu küçük bir kadeh ya da shot bardağına dökün.',
      'Bir bar kaşığının sırtından dökerek nane likörünü üzerine yavaşça katmanlayın.',
      'Aynı şekilde konyağı da üzerine yavaşça katmanlayın.',
    ],
  },
  alexander: {
    description: 'Cin, kakao likörü ve krema, ipeksi olana kadar çalkalanır. Daha tanınmış Brandy Alexander’ın üzerine kurulduğu cinli orijinal.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir coupe kadehine süzün.', 'Üzerine biraz muskat rendeleyin.'],
    garnish: 'Rendelenmiş muskat',
  },
  'velvet-hammer': {
    description: 'Triple sec, kakao likörü ve krema, pürüzsüz olana kadar çalkalanır. Tatlı ama aldatıcı derecede sert bir 1960’lar klasiği.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  'fifth-avenue': {
    description: 'Kakao likörü, kayısı likörü ve krema, küçük bir bardakta özenle katmanlanır. Tatlı, vintage bir katmanlı kokteyl.',
    steps: [
      'Kakao likörünü küçük bir kadeh ya da shot bardağına dökün.',
      'Bir bar kaşığının sırtından dökerek kayısı likörünü üzerine yavaşça katmanlayın.',
      'Aynı şekilde kremayı da üzerine yavaşça katmanlayın.',
    ],
  },
  'angels-delight': {
    description: 'Sloe cin, kayısı likörü, triple sec ve krema, küçük bir bardakta özenle katmanlanır. Tatlı, pastel renkli bir vintage katmanlı shot.',
    steps: [
      'Sloe cini küçük bir kadeh ya da shot bardağına dökün.',
      'Bir bar kaşığının sırtından dökerek kayısı likörünü üzerine yavaşça katmanlayın.',
      'Aynı şekilde triple seci de üzerine yavaşça katmanlayın.',
      'Son olarak kremayı üzerine yavaşça katmanlayın.',
    ],
  },
  'sloe-gin-fizz': {
    description: 'Sloe cin, limon suyu ve şeker, çalkalanıp sodayla tamamlanır. Meyveli, kolay içilen bir fizz.',
    steps: [
      'Sloe cin, limon suyu ve şurubu buzla çalkalayın.',
      'Taze buz üzerine bir highball bardağına süzün.',
      'Sodayla tamamlayın ve hafifçe karıştırın.',
    ],
  },
  'three-dots-and-a-dash': {
    description: 'Altın ve koyu rom, falernum, orgeat, yenibahar şurubu ve narenciyeyle, sert şekilde çalkalanır. "Zafer" için Mors alfabesinden adını alan, zengin ve baharatlı bir Don the Beachcomber klasiği.',
    steps: ['Tüm malzemeleri buzla sert şekilde çalkalayın.', 'Kırık buz üzerine bir tiki bardağına süzün.', 'Bir kokteyl çubuğuna geçirilmiş vişne ve ananas dilimiyle süsleyin.'],
    garnish: 'Vişne ve ananas dilimi',
  },
  'saturn-cocktail': {
    description: 'Cin, çarkıfelek meyvesi şurubu, limon suyu, falernum ve orgeat, birlikte çalkalanır. 1967’den, Los Angeles’ta yaratılan resmi bir IBA tiki-yakını klasiği.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir coupe kadehine süzün.', 'Bir limon kabuğuyla süsleyin.'],
    garnish: 'Limon kabuğu',
  },
  beachcomber: {
    description: 'Beyaz rom, triple sec, maraschino likörü ve misket limonu suyu, çalkalanıp süzülür. Basit, narenciye ağırlıklı bir Don the Beachcomber orijinali.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  'test-pilot': {
    description: 'Koyu ve beyaz rom, falernum, triple sec, misket limonu ve bir absinth durulaması. Modern barmenlerin yeniden canlandırdığı sevilen bir Don the Beachcomber tiki klasiği.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Kırık buz üzerine bir tiki bardağına süzün.'],
  },
  'kon-tiki': {
    description: 'Altın rom, misket limonu suyu, bal şurubu, orgeat ve çarkıfelek meyvesi şurubu, sert şekilde çalkalanır. Ünlü sal seferinden adını alan, zengin ve tropikal bir tiki klasiği.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Kırık buz üzerine bir tiki bardağına süzün.', 'Bir nane dalıyla süsleyin.'],
    garnish: 'Nane dalı',
  },
  'ti-punch': {
    description: 'Rhum agricole, bir tutam şeker kamışı şurubu ve bir sıkım misket limonu, doğrudan bardakta karıştırılır. Martinik’in güçlü, basit ve damak zevkine göre ayarlanan günlük ritüel içkisi.',
    steps: [
      'Bir rocks bardağına şeker kamışı şurubu ve bir sıkım misket limonu ekleyin.',
      'Rhum agricole’u ekleyip kısaca karıştırın.',
      'Az ya da hiç buz kullanmadan, sıkılmış misket limonu kabuğuyla birlikte servis edin.',
    ],
  },
  'cucumber-cooler': {
    description: 'Ezilmiş salatalık ve nane, misket limonu ve bir tutam şurupla, sodayla tamamlanır. Ferahlatıcı, otsu bir alkolsüz içecek.',
    steps: [
      'Salatalık ve naneyi misket limonu suyu ve şeker şurubuyla bir shaker’da ezin.',
      'Buz ekleyip kısaca çalkalayın.',
      'Taze buz üzerine bir highball bardağına süzün.',
      'Sodayla tamamlayın ve hafifçe karıştırın.',
    ],
    garnish: 'Salatalık kurdelesi',
  },
  'sparkling-cranberry-spritz': {
    description: 'Kızılcık suyu, gazlı limonatayla canlandırılır, buz üzerinde. Bayramlık, ekşimsi, alkolsüz bir spritz.',
    steps: ['Bir şarap kadehini buzla doldurun.', 'Kızılcık suyunu ekleyin.', 'Gazlı limonatayla tamamlayıp hafifçe karıştırın.', 'Taze kızılcık ya da bir dilim portakalla süsleyin.'],
    garnish: 'Taze kızılcık ya da portakal dilimi',
  },
  'kombucha-mule': {
    description: 'Kombucha, misket limonu suyu ve zencefil şurubu, buz üzerinde. Moscow Mule’a doğal olarak ekşimsi, köpüklü, alkolsüz bir yorum.',
    steps: ['Bir bakır bardağı buzla doldurun.', 'Misket limonu suyu ve zencefil şurubunu ekleyin.', 'Kombuchayla tamamlayın ve hafifçe karıştırın.'],
    garnish: 'Misket limonu dilimi',
  },
  'watermelon-cooler': {
    description: 'Karpuz suyu, misket limonu ve ezilmiş nane, sodayla tamamlanır. Hafif, susuzluk giderici bir yaz mocktail’i.',
    steps: [
      'Naneyi misket limonu suyuyla bir shaker’da hafifçe ezin.',
      'Karpuz suyunu ve buzu ekleyip kısaca çalkalayın.',
      'Taze buz üzerine bir highball bardağına süzün.',
      'Sodayla tamamlayın ve hafifçe karıştırın.',
    ],
    garnish: 'Nane dalı, karpuz dilimi',
  },
  'roy-rogers': {
    description: 'Kola ve bir tutam nar şurubu, buz üzerinde, bir vişneyle süslenir. Kovboy aktörünün adını taşıyan, Shirley Temple’ın alkolsüz muadili.',
    steps: ['Bir highball bardağını buzla doldurun.', 'Kola ve nar şurubunu ekleyin.', 'Hafifçe karıştırıp bir vişneyle süsleyin.'],
    garnish: 'Vişne',
  },
  'ginger-fizz': {
    description: 'Zencefil şurubu ve limon suyu, sodayla tamamlanır. Baharatlı, alkolsüz bir fizz.',
    steps: ['Bir highball bardağını buzla doldurun.', 'Zencefil şurubu ve limon suyunu ekleyin.', 'Sodayla tamamlayın ve hafifçe karıştırın.'],
  },
  'lavender-lemonade': {
    description: 'Limonataya karıştırılan lavanta şurubu, buz üzerinde. Kokulu, çiçeksi, kolay içilen bir mocktail.',
    steps: ['Bir highball bardağını buzla doldurun.', 'Lavanta şurubu ve limonatayı ekleyin.', 'İyice karıştırıp bir lavanta ya da nane dalıyla süsleyin.'],
    garnish: 'Lavanta ya da nane dalı',
  },
  'rosemary-greyhound-mocktail': {
    description: 'Greyfurt suyu, bir tutam biberiye şurubuyla, buz üzerinde. Greyhound’a alkolsüz, otsu bir yorum.',
    steps: ['Bir highball bardağını buzla doldurun.', 'Greyfurt suyu ve biberiye şurubunu ekleyin.', 'İyice karıştırıp bir biberiye dalıyla süsleyin.'],
    garnish: 'Biberiye dalı',
  },
  'st-clements': {
    description: 'Eşit oranda portakal suyu ve gazlı bir limon sodası. İngiliz tekerlemesinden adını alan klasik bir alkolsüz pub siparişi.',
    steps: ['Bir highball bardağını buzla doldurun.', 'Portakal suyu ve gazlı limonatayı ekleyin.', 'Hafifçe karıştırın.'],
  },
  'raspberry-mint-cooler': {
    description: 'Ezilmiş ahududu ve nane, misket limonu ve şurupla, sodayla tamamlanır. Canlı, meyve ağırlıklı bir alkolsüz serinletici.',
    steps: [
      'Ahududu ve naneyi misket limonu suyu ve şeker şurubuyla bir shaker’da ezin.',
      'Buz ekleyip kısaca çalkalayın.',
      'Taze buz üzerine bir highball bardağına süzün.',
      'Sodayla tamamlayın ve hafifçe karıştırın.',
    ],
    garnish: 'Ahududu, nane dalı',
  },
  'virgin-caesar': {
    description: 'Misket limonu, acı sos ve Worcestershire ile tatlandırılmış Clamato suyu, buz üzerinde. Kanada’nın ulusal brunch kokteylinin alkolsüz hâli.',
    steps: [
      'Bir highball bardağını buzla doldurun.',
      'Clamato suyu ve misket limonu suyunu ekleyin.',
      'Acı sos ve Worcestershire sosuyla tatlandırıp karıştırın.',
      'Bir sap kerevizle süsleyin.',
    ],
    garnish: 'Kereviz sapı',
  },

  // ---- additions4 (basit/highball/punç ve dağınık ek klasikler) ----
  'gin-fizz': {
    description: 'Cin, limon suyu ve şeker, çalkalanıp sodayla tamamlanır. Diğer tüm fizzlerin üzerine kurulduğu basit, temel format.',
    steps: ['Cin, limon suyu ve şurubu buzla çalkalayın.', 'Taze buz üzerine bir highball bardağına süzün.', 'Sodayla tamamlayın ve hafifçe karıştırın.'],
  },
  'amaretto-and-soda': {
    description: 'Amaretto, buz üzerinde sodayla uzatılır. Bir yemek sonrası içkisi olabileceği kadar basit.',
    steps: ['Bir highball bardağını buzla doldurun.', 'Amarettoyu ekleyin.', 'Sodayla tamamlayın ve hafifçe karıştırın.'],
  },
  'campari-soda': {
    description: 'Campari, buz üzerinde sodayla tamamlanır. Keskin bir şekilde acı, son derece basit bir İtalyan aperitivo siparişi.',
    steps: ['Bir highball bardağını buzla doldurun.', 'Campariyi ekleyin.', 'Sodayla tamamlayın ve hafifçe karıştırın.'],
    garnish: 'Portakal dilimi',
  },
  'pimms-cup': {
    description: 'Cin bazlı bir meyveli likör, limonata ve salatalıkla uzatılır. Tam anlamıyla İngiliz bir yaz bahçe partisi içkisi.',
    steps: [
      'Bir collins bardağını buzla doldurun.',
      'Meyveli likörü ve salatalık dilimlerini ekleyin.',
      'Limonatayla tamamlayın ve hafifçe karıştırın.',
      'Salatalık kurdelesi, nane ve bir dilim portakal ya da çilekle süsleyin.',
    ],
    garnish: 'Salatalık, nane, portakal ya da çilek dilimi',
  },
  'fish-house-punch': {
    description: 'Koyu rom, konyak ve şeftali likörü, limon ve demerara şurubuyla. Sömürge dönemi Philadelphia’sından zengin, sert bir punç — belgelenen en eski Amerikan kokteyllerinden biri.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Taze buz üzerine bir rocks bardağına süzün.'],
  },
  'trinidad-sour': {
    description: 'Ana içkinin değil Angostura bitterinin baskın olduğu çarpıcı, tersine çevrilmiş bir ekşi — bitter, orgeat, limon ve az miktarda çavdar viskisi. 2010’ların ünlü bir modern klasiği.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  'jamaican-mule': {
    description: 'Votka yerine koyu Jamaika tarzı romla yapılan bir Moscow Mule — koyu rom ve misket limonu suyu, zencefilli birayla tamamlanır.',
    steps: ['Bir bakır bardağı buzla doldurun.', 'Rom ve misket limonu suyunu ekleyin.', 'Zencefilli birayla tamamlayın ve hafifçe karıştırın.'],
    garnish: 'Misket limonu dilimi',
  },
  godmother: {
    description: 'Votka ve amaretto, buz üzerinde. Godfather’ın basit, fındıksı bir akrabası.',
    steps: ['Bir rocks bardağını buzla doldurun.', 'Votka ve amarettoyu ekleyin.', 'Kısaca karıştırın.'],
  },
  'boston-sour': {
    description: 'İpeksi, köpüklü bir doku için içine yumurta akı çalkalanan bir Whiskey Sour. Aynı içkinin süslenmiş hâli.',
    steps: [
      'Yumurta akını emülsifiye etmek için tüm malzemeleri buzsuz çalkalayın.',
      'Buz ekleyip iyice soğuyana kadar tekrar çalkalayın.',
      'Taze buz üzerine bir rocks bardağına süzün.',
      'İsteğe bağlı olarak üzerine birkaç damla bitterle süsleyin.',
    ],
  },
  'bourbon-highball': {
    description: 'Bourbon, buz üzerinde soğuk sodayla uzatılır. İyi bir viskiyi servis etmenin basit, keskin, sonsuz içilebilir yolu.',
    steps: ['Bir highball bardağını buzla doldurun.', 'Bourbonu ekleyin.', 'Sodayla tamamlayın ve hafifçe karıştırın.'],
  },
  'vodka-soda': {
    description: 'Votka, soda ve bir sıkım misket limonu, buz üzerinde. Herhangi bir bardaki en basit, en düşük kalorili sipariş.',
    steps: ['Bir highball bardağını buzla doldurun.', 'Votka ve misket limonu suyunu ekleyin.', 'Sodayla tamamlayın ve hafifçe karıştırın.'],
    garnish: 'Misket limonu dilimi',
  },
  'whiskey-ginger': {
    description: 'Bourbon, buz üzerinde zencefilli gazozla tamamlanır. Standart, sorunsuz bir bar siparişi.',
    steps: ['Bir highball bardağını buzla doldurun.', 'Bourbonu ekleyin.', 'Zencefilli gazozla tamamlayın ve hafifçe karıştırın.'],
  },
  'rum-punch': {
    description: 'Koyu ve beyaz rom, portakal, ananas ve misket limonu suyuyla, nar şurubuyla tatlandırılıp bitterle baharatlanır. Sonsuz varyasyonu olan, genel bir Karayip plaj barı punçu.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Taze buz üzerine bir hurricane kadehine süzün.', 'Bir dilim ananas ve bir vişneyle süsleyin.'],
    garnish: 'Ananas dilimi, vişne',
  },
  'brandy-and-soda': {
    description: 'Konyak, buz üzerinde sodayla uzatılır. İyi bir brendiyi uzatmanın klasik, sade bir yolu.',
    steps: ['Bir highball bardağını buzla doldurun.', 'Konyağı ekleyin.', 'Sodayla tamamlayın ve hafifçe karıştırın.'],
  },
  gibson: {
    description: 'Zeytin ya da kabuk yerine bir turşu soğanıyla süslenen çok sek bir Martini. Basit, içki ağırlıklı ve kendine özgü.',
    steps: ['Cin ve vermutu buzla birlikte bir karıştırma bardağına ekleyin.', 'İyice soğuyana kadar karıştırın.', 'Soğutulmuş bir martini kadehine süzün.'],
    garnish: 'Turşu soğanı',
  },
  'twentieth-century-cocktail': {
    description: 'Cin, Lillet Blanc, beyaz kakao likörü ve limon suyu, birlikte çalkalanır. Ünlü bir trenden adını alan zarif bir Altın Çağ klasiği.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  'satans-whiskers': {
    description: 'Cin, sek ve tatlı vermut, portakal suyu, portakallı curaçao ve portakal bitteri. Her açıdan portakalla katmanlanmış bir Savoy Cocktail Book klasiği.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  'income-tax-cocktail': {
    description: 'Cin, sek ve tatlı vermut, portakal suyu ve bitter, birlikte çalkalanır. Savoy döneminden bir klasik — aslında bitter eklenmiş bir Bronx Cocktail.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  'army-and-navy': {
    description: 'Cin, limon suyu ve orgeat, köpüklü olana kadar çalkalanır. Klasik cin ekşisi formatının basit, fındıksı bir modern klasik yorumu.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  'hanky-panky': {
    description: 'Cin ve tatlı vermut, bir tutam Fernet ile karıştırılır. Londra’daki Savoy Hotel’in American Bar’ında Ada Coleman tarafından yaratılmıştır.',
    steps: [
      'Tüm malzemeleri buzla birlikte bir karıştırma bardağına ekleyin.',
      'İyice soğuyana kadar karıştırın.',
      'Soğutulmuş bir coupe kadehine süzün.',
      'Üzerine bir portakal kabuğu sıkın.',
    ],
    garnish: 'Portakal kabuğu',
  },
  'french-blonde': {
    description: 'Cin, mürver çiçeği likörü, limon suyu ve greyfurt bitteri, birlikte çalkalanır. Death & Co’dan çiçeksi, narenciye ağırlıklı bir 2010’lar modern klasiği.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir coupe kadehine süzün.'],
  },
  'vodka-martini': {
    description: 'Cin yerine votkayla yapılan bir Martini — votka ve bir tutam sek vermut, buz gibi olana kadar karıştırılır.',
    steps: ['Votka ve vermutu buzla birlikte bir karıştırma bardağına ekleyin.', 'İyice soğuyana kadar karıştırın.', 'Soğutulmuş bir martini kadehine süzün.'],
    garnish: 'Limon kabuğu ya da zeytin',
  },
  'lemon-drop-martini': {
    description: 'Votka, triple sec ve limon suyu, çalkalanıp şeker kenarlı bir bardakta servis edilir. Ekşi, tatlı, şeker tozlu bir modern bar klasiği.',
    steps: [
      'Soğutulmuş bir martini kadehi ya da coupe’nin kenarını şekerleyin.',
      'Tüm malzemeleri buzla çalkalayın.',
      'Hazırladığınız kadehe süzün.',
    ],
    garnish: 'Şeker kenar, limon kabuğu',
  },
  'watermelon-martini': {
    description: 'Votka, taze karpuz suyu, triple sec ve misket limonu, pembe ve köpüklü olana kadar çalkalanır. Popüler bir modern yaz bar kokteyli.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Soğutulmuş bir martini kadehi ya da coupe’ye süzün.'],
    garnish: 'Karpuz dilimi',
  },
  'perfect-manhattan': {
    description: 'Sadece tatlı vermut yerine eşit oranda sek ve tatlı vermutla yapılan bir Manhattan — klasiğin daha sek, daha dengeli bir hâli.',
    steps: ['Tüm malzemeleri buzla birlikte bir karıştırma bardağına ekleyin.', 'İyice soğuyana kadar karıştırın.', 'Soğutulmuş bir coupe kadehine süzün.'],
    garnish: 'Limon kabuğu',
  },
  eggnog: {
    description: 'Bourbon ve konyak, bütün bir yumurta, krema ve şurupla çalkalanıp rendelenmiş muskatla tamamlanır. Zengin, baharatlı bir bayram klasiği.',
    steps: [
      'Tüm malzemeleri iyice karışana kadar buzsuz çalkalayın.',
      'Buz ekleyip iyice soğuyana kadar sert şekilde çalkalayın.',
      'Bir bardağa ya da irish coffee kadehine süzün.',
      'Üzerine taze muskat rendeleyin.',
    ],
    garnish: 'Rendelenmiş muskat',
  },
  'hot-toddy': {
    description: 'İrlanda viskisi, bal şurubu ve limon suyu, sıcak suyla tamamlanır. Soğuk bir gece için ısıtıcı, rahatlatıcı bir klasik.',
    steps: [
      'Viski, bal şurubu ve limon suyunu ısıtılmış bir bardağa ekleyin.',
      'Sıcak suyla tamamlayıp karıştırın.',
      'Bir tarçın çubuğu ve karanfil saplanmış bir limon diliminle süsleyin.',
    ],
    garnish: 'Tarçın çubuğu, limon dilimi',
  },
  'cable-car': {
    description: 'Baharatlı rom, portakallı curaçao ve limon suyu, çalkalanıp tarçınlı şeker kenarlı bir kadehte servis edilir. San Francisco’daki Starlight Room’da yaratılan bir modern klasik.',
    steps: [
      'Soğutulmuş bir coupe kadehinin kenarını tarçınlı şekerle kaplayın.',
      'Tüm malzemeleri buzla çalkalayın.',
      'Hazırladığınız kadehe süzün.',
    ],
    garnish: 'Tarçınlı şeker kenar',
  },
  'rum-runner': {
    description: 'Koyu ve hindistan cevizi romu, muz ve böğürtlen likörleriyle, meyve suyu ve bir tutam nar şurubuyla uzatılır. Florida Keys’ten tatlı, meyve katmanlı bir klasik.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Taze buz üzerine bir hurricane kadehine süzün.', 'Bir vişne ve portakal diliminle süsleyin.'],
    garnish: 'Vişne, portakal dilimi',
  },
  'ranch-water': {
    description: 'Blanco tekila, misket limonu suyu ve soda, buz üzerinde. Üç malzemeli, bomboş sek bir modern Teksas klasiği.',
    steps: ['Bir highball bardağını buzla doldurun.', 'Tekila ve misket limonu suyunu ekleyin.', 'Sodayla tamamlayın ve hafifçe karıştırın.'],
    garnish: 'Misket limonu dilimi',
  },
  'tequila-old-fashioned': {
    description: 'Viski yerine añejo tekilayla yapılan bir Old Fashioned — tekila, agave şurubu ve bitter, buz üzerinde karıştırılır.',
    steps: [
      'Tüm malzemeleri buzla birlikte bir karıştırma bardağına ekleyin.',
      'İyice soğuyana kadar karıştırın.',
      'Büyük bir buz küpü üzerine bir rocks bardağına süzün.',
      'Bir portakal kabuğunu üzerine sıkarak yağını çıkarın ve bardağa bırakın.',
    ],
    garnish: 'Portakal kabuğu',
  },
  'spicy-margarita': {
    description: 'İçine taze jalapeño ezilen bir Margarita — blanco tekila, triple sec ve misket limonu suyu, gerçek bir acılıkla.',
    steps: [
      'Jalapeño dilimlerini bir shaker’da ezin.',
      'Tekila, triple sec ve misket limonu suyunu ekleyip buzla çalkalayın.',
      'Çift süzerek tuz kenarlı bir rocks bardağına, taze buz üzerine dökün.',
    ],
    garnish: 'Jalapeño dilimi, tuz kenar',
  },
  'strawberry-margarita': {
    description: 'Taze çilekle blenderdan geçirilen bir Margarita — blanco tekila, triple sec, misket limonu ve agave şurubu. Popüler bir meyveli yorum.',
    steps: ['Tüm malzemeleri bir bardak buzla blendera ekleyin.', 'Pürüzsüz olana kadar karıştırın.', 'Tuz kenarlı bir rocks bardağına ya da coupe’ye dökün.'],
    garnish: 'Çilek dilimi, tuz kenar',
  },
  'frozen-daiquiri': {
    description: 'Beyaz rom, misket limonu suyu ve şeker şurubu, sulu buz kıvamına gelene kadar buzla blenderdan geçirilir. Klasik Daiquiri’nin blend edilmiş hâli.',
    steps: ['Tüm malzemeleri bir bardak buzla blendera ekleyin.', 'Pürüzsüz ve sulu buz kıvamına gelene kadar karıştırın.', 'Soğutulmuş bir coupe kadehine dökün.'],
  },
  'frozen-strawberry-daiquiri': {
    description: 'Taze çilekle blenderdan geçirilen bir Frozen Daiquiri — beyaz rom, misket limonu suyu, şeker şurubu ve çilek, kırık buz üzerinde.',
    steps: ['Tüm malzemeleri bir bardak buzla blendera ekleyin.', 'Pürüzsüz ve sulu buz kıvamına gelene kadar karıştırın.', 'Bir hurricane kadehine ya da coupe’ye dökün.'],
    garnish: 'Çilek dilimi',
  },
  'frozen-margarita': {
    description: 'Sulu buz kıvamına gelene kadar buzla blenderdan geçirilen bir Margarita — blanco tekila, triple sec ve misket limonu suyu. Klasiğin havuz başı versiyonu.',
    steps: ['Tüm malzemeleri bir bardak buzla blendera ekleyin.', 'Pürüzsüz ve sulu buz kıvamına gelene kadar karıştırın.', 'Tuz kenarlı bir rocks bardağına ya da coupe’ye dökün.'],
    garnish: 'Misket limonu dilimi, tuz kenar',
  },
  'blue-hawaiian': {
    description: 'Beyaz rom, mavi curaçao, ananas suyu ve hindistan cevizi kreması, parlak mavi ve köpüklü olana kadar blenderdan geçirilir. Tiki-pop bir favori.',
    steps: ['Tüm malzemeleri bir bardak buzla blendera ekleyin.', 'Pürüzsüz olana kadar karıştırın.', 'Bir hurricane kadehine dökün.', 'Bir dilim ananas ve bir vişneyle süsleyin.'],
    garnish: 'Ananas dilimi, vişne',
  },
  'miami-vice': {
    description: 'Bir Piña Colada ve bir Strawberry Daiquiri, ayrı ayrı blenderdan geçirilip iki renkli bir efekt için yan yana dökülür. Havuz başı bir novelty klasiği.',
    steps: [
      'Romun yarısını ananas suyu, hindistan cevizi kreması ve bir bardak buzla pürüzsüz olana kadar karıştırıp bir hurricane kadehinin bir tarafına dökün.',
      'Blenderi durulayıp kalan romu çilek, şeker şurubu ve bir bardak buzla pürüzsüz olana kadar karıştırın.',
      'Çilekli karışımı, iki renk yan yana dursun diye aynı kadehin diğer tarafına dikkatlice dökün.',
    ],
    garnish: 'Çilek dilimi',
  },
  'champagne-cocktail': {
    description: 'Bitterle doyurulmuş bir şeker küpü, üzerine konyak ve şampanya dökülerek tamamlanır. 1800’lere dayanan, en eski ve en zarif şampanya içkilerinden biri.',
    steps: [
      'Bir şeker küpünü soğutulmuş bir şampanya kadehine koyup bitterle doyurun.',
      'Konyağı ekleyin.',
      'Yavaşça şampanyayla tamamlayın.',
      'Bir limon kabuğuyla süsleyin.',
    ],
    garnish: 'Limon kabuğu',
  },
  'pisco-punch': {
    description: 'Pisco, ananas suyu, misket limonu ve şurup, birlikte çalkalanır. San Francisco’nun Altın Çağı’ndan, bir zamanlar dünya çapında ünlü olan 19. yüzyıl klasiği.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Taze buz üzerine bir rocks ya da collins bardağına süzün.'],
  },
  'hugo-spritz': {
    description: 'Prosecco ve mürver çiçeği likörü, bir tutam soda ve taze naneyle. Aperol Spritz’e popüler, daha az acı bir modern alternatif.',
    steps: [
      'Bir şarap kadehini buzla doldurun.',
      'Mürver çiçeği likörü ve proseccoyu ekleyin.',
      'Bir tutam soda ile tamamlayıp hafifçe karıştırın.',
      'Bolca nane dalıyla süsleyin.',
    ],
    garnish: 'Nane dalı',
  },
  'brave-bull': {
    description: 'Tekila ve kahve likörü, buz üzerinde basitçe hazırlanır. Black Russian’ın tekila bazlı bir akrabası.',
    steps: ['Bir rocks bardağını buzla doldurun.', 'Tekila ve kahve likörünü ekleyin.', 'Kısaca karıştırın.'],
  },
  'toasted-almond': {
    description: 'Kahve likörü, amaretto ve krema, buz üzerinde çalkalanır ya da hazırlanır. Fındıksı, tatlı tarzı bir yudumluk.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Taze buz üzerine bir rocks bardağına süzün.'],
  },
  mudslide: {
    description: 'Votka, kahve likörü ve İrlanda kreması likörü, kremayla çalkalanır ya da blenderdan geçirilir. Zengin, tatlı tarzı bir 1970’ler bar klasiği.',
    steps: ['Tüm malzemeleri buzla çalkalayın.', 'Taze buz üzerine bir rocks bardağına süzün.'],
  },
  'spanish-coffee': {
    description: 'Kahve likörü ve portakallı curaçao, sıcak kahveye karıştırılıp üzerine krema yüzdürülür. Bayramlık, katmanlı bir kahve kokteyli.',
    steps: [
      'Kahve likörü ve portakallı curaçaoyu ısıtılmış bir irish coffee kadehine ekleyin.',
      'Sıcak kahveyle tamamlayıp karıştırın.',
      'Kremayı bir kaşığın sırtından dökerek üzerine yüzdürün.',
    ],
  },
  'keoke-coffee': {
    description: 'Konyak, kahve likörü ve kakao likörü, sıcak kahveye karıştırılıp kremayla tamamlanır. Zengin, çikolatalı bir yemek sonrası kahve içkisi.',
    steps: [
      'Konyak, kahve likörü ve kakao likörünü ısıtılmış bir irish coffee kadehine ekleyin.',
      'Sıcak kahveyle tamamlayıp karıştırın.',
      'Kremayı bir kaşığın sırtından dökerek üzerine yüzdürün.',
    ],
  },
  'champagne-punch': {
    description: 'Şampanya, konyak, portakallı curaçao, limon ve bir tutam şurupla uzatılır. Bir parti punçu klasiğinin basit, tek kişilik bir yorumu.',
    steps: [
      'Konyak, portakallı curaçao, limon suyu ve şurubu bir şarap kadehinde buzla karıştırın.',
      'Şampanyayla tamamlayıp hafifçe karıştırın.',
      'Mevsim meyveleriyle süsleyin.',
    ],
    garnish: 'Mevsim meyveleri',
  },
  'whiskey-milk-punch': {
    description: 'Bourbon, krema, şeker ve vanilyayla çalkalanıp muskatla tamamlanır. New Orleans’tan zengin, yumuşak bir brunch klasiği.',
    steps: ['Tüm malzemeleri buzla sert şekilde çalkalayın.', 'Taze buz üzerine bir rocks ya da collins bardağına süzün.', 'Üzerine taze muskat rendeleyin.'],
    garnish: 'Rendelenmiş muskat',
  },
  'black-and-tan': {
    description: 'Stout, açık renkli bir larger biranın üzerine özenle katmanlanarak iki belirgin bant oluşturulur. Tamamen tekniğe dayanan bir pub klasiği.',
    steps: [
      'Bir pint bardağını yarısına kadar lager birayla doldurun.',
      'Stout’u bir kaşığın sırtından dökerek, karışmadan üzerinde yüzmesini sağlayın.',
    ],
  },
  'irish-car-bomb': {
    description: 'İrlanda viskisi ve İrlanda kreması likörü bir bardak stout içine bırakılıp krema biranın içinde kesilmeden hemen içilir. Bilinen bir parti shot’ı.',
    steps: [
      'Stout’u bir pint bardağına, yaklaşık dörtte üçüne kadar doldurun.',
      'Bir shot bardağında İrlanda kremasını viskinin üzerine katmanlayın.',
      'Shot bardağını stout’un içine bırakın ve kesilmeden hemen için.',
    ],
  },
  'suffering-bastard': {
    description: 'Cin, konyak, misket limonu ve bitter, zencefilli birayla tamamlanır. II. Dünya Savaşı sırasında Kahire’deki Shepheard’s Hotel’de icat edildiği söylenen, akşamdan kalmalığa iyi gelen bir klasik.',
    steps: [
      'Cin, konyak, misket limonu suyu ve bitteri buzla çalkalayın.',
      'Taze buz üzerine bir bakır bardağa ya da highball bardağına süzün.',
      'Zencefilli birayla tamamlayın ve hafifçe karıştırın.',
      'Bir nane dalı ve bir salatalık dilimiyle süsleyin.',
    ],
    garnish: 'Nane dalı, salatalık dilimi',
  },
};
