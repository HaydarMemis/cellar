import { Locale } from '../../i18n/types';
import { legalFields } from './fields';
import { LegalDoc } from './types';

/**
 * A factually accurate description of what Cellar's code does with data
 * (checked against the SDKs actually integrated: Supabase, RevenueCat, Apple /
 * Google sign-in, optional Sentry crash reporting). DRAFT until reviewed by a
 * lawyer — the bracketed business fields must be real values and the
 * jurisdiction-specific rights section completed before publication
 * (KVKK for Türkiye; GDPR for EU users, if targeted). Keep EN and TR in sync.
 */
export function getPrivacyPolicy(locale: Locale = 'en'): LegalDoc {
  const { entity, address, jurisdiction, supportEmail, dataRegion } = legalFields(locale);
  if (locale === 'tr') {
    return {
      sections: [
        {
          heading: 'Biz kimiz',
          paragraphs: [
            `Cellar; kokteyl tarifleri, keşif ve ev barı uygulamasıdır. Veri sorumlusu: ${entity}, ${address} (${jurisdiction}). İletişim: ${supportEmail}.`,
          ],
        },
        {
          heading: 'Hesap olmadan',
          paragraphs: [
            'Katalogda gezinme, arama, filtreler, malzeme eşleştirme, favoriler, Barım, tadım günlüğü, alışveriş listesi ve kişisel (gizli) tarifler tamamen cihazında çalışır. Bu veriler cihazında saklanır; bir hesap oluşturup bir şey yayınlamadığın sürece bize veya başkasına gönderilmez.',
          ],
        },
        {
          heading: 'Hesap oluşturduğunda işlenen veriler',
          paragraphs: ['Hesap oluşturduğunda veya tarif yayınladığında aşağıdaki veriler altyapı sağlayıcımız Supabase’e gönderilir:'],
          bullets: [
            'Hesap: e-posta adresin, kullanıcı adın, görünen adın ve isteğe bağlı biyografin.',
            'Kimlik doğrulama: şifreyle kaydolursan şifren Supabase tarafından özetlenmiş (hash) olarak saklanır; ham şifreni hiçbir zaman görmeyiz. Apple veya Google ile giriş yaparsan, sağlayıcının doğruladığı kullanıcı kimliğini ve paylaşmayı seçtiğin ad/e-postayı (Apple’ın “E-postamı Gizle” adresi dahil) alırız.',
            'Yayınlanan (herkese açık) tarifler: ad, açıklama, malzemeler, yöntem, adımlar ve eklediğin fotoğraf — uygulamayı kullanan herkes görebilir.',
            'Sosyal etkileşimler: takip ettiklerin, seni takip edenler, beğendiğin tarifler ve engellediğin kullanıcılar (engelleme listen yalnızca sana görünür).',
            'Şikâyetler: bir tarifi veya kullanıcıyı şikâyet ettiğinde şikâyet içeriği ve hesap kimliğin saklanır.',
            'Satın almalar: Premium alırsan ödeme sağlayıcımız RevenueCat (Apple App Store / Google Play üzerinde) abonelik durumunu hesap kimliğinle birlikte kaydeder. Premium durumunun bir kopyası (etkin olup olmadığı, plan ve son güncelleme zamanı) da Supabase veritabanımızda tutulur. Kart bilgilerini hiçbir zaman almayız.',
          ],
        },
        {
          heading: 'Fotoğraflar',
          paragraphs: [
            'Bir tarife fotoğraf eklediğinde sistemin fotoğraf seçicisi kullanılır; uygulama yalnızca seçtiğin fotoğrafa erişir, fotoğraf arşivinin tamamına erişmez. Fotoğraf küçültülür ve cihazına kaydedilir. Gizli bir tarifteki fotoğraf cihazında kalır; yayınladığın bir tarifin fotoğrafı diğer kullanıcıların görebilmesi için depolama altyapımıza yüklenir.',
          ],
        },
        {
          heading: 'Hata raporları',
          paragraphs: [
            'Uygulama çökerse veya bir hata oluşursa, bu özellik etkinse hata ayrıntıları (hata mesajı, uygulama sürümü, cihaz modeli, işletim sistemi ve varsa takma adlı hesap kimliğin — adını veya e-postanı içermeyen rastgele bir kimlik) hata izleme hizmetimiz Sentry’ye gönderilir. Tarif içeriği, e-posta adresi, şifre veya oturum anahtarları gönderilmez.',
          ],
        },
        {
          heading: 'Verilerini işleyen hizmetler',
          bullets: [
            `Supabase — veritabanı, kimlik doğrulama, dosya depolama ve hesap silme işlevi (barındırma bölgesi: ${dataRegion}).`,
            'RevenueCat — satın alma ve abonelik durumu.',
            'Apple / Google — yalnızca “Apple ile devam et” veya “Google ile devam et”i seçersen; bu girişle ilgili gördükleri kendi gizlilik politikalarına tabidir.',
            'Sentry — hata raporları (etkinse).',
          ],
          paragraphs: ['Bu hizmetler verilerini bizim adımıza işler. Bazıları verileri AB dışında (örneğin ABD’de) işleyebilir.', 'Uygulama bu hizmetlere bağlandığında, her internet hizmetinde olduğu gibi cihazının IP adresini de alırlar.'],
        },
        {
          heading: 'Reklam ve izleme yok',
          paragraphs: [
            'Cellar reklam göstermez, üçüncü taraf analiz veya izleme araçları kullanmaz ve verilerini satmaz. Bu değişirse, bu bölüm ve App Store / Google Play gizlilik beyanları değişiklik yayınlanmadan önce güncellenir.',
          ],
        },
        {
          heading: 'Saklama süresi ve hesap silme',
          paragraphs: [
            'Hesap verilerin hesabını silene kadar saklanır. Hesabını istediğin zaman uygulama içinden Profil → Hesabı sil ile kalıcı olarak silebilirsin. Bu işlem kimlik bilgilerini, profilini, yayınladığın tarifleri ve fotoğraflarını, beğenilerini, takiplerini ve engellemelerini sunucularımızdan siler; Apple ile giriş kullandıysan Cellar’ın Apple kimliğine erişimini de iptal eder. RevenueCat’ten de hesabına bağlı satın alma durumu kaydını silmesini isteriz; mağazadaki satın alma geçmişin Apple / Google’da kalır. Moderasyon kaydı olarak tutulan şikâyetler, seninle ilişkilendirilmeden saklanmaya devam eder. Silinen veriler sağlayıcılarımızın yedeklerinde sınırlı bir süre daha bulunabilir. Yalnızca cihazında tutulan veriler, uygulamayı silene kadar cihazında kalır.',
          ],
        },
        {
          heading: 'Yaş',
          paragraphs: ['Cellar alkollü içecek tarifleri içerir ve bulunduğun yerdeki yasal alkol tüketme yaşının altındaki kişilere yönelik değildir.'],
        },
        {
          heading: 'Hakların',
          paragraphs: [
            `Verilerine erişme, düzeltme, silme ve işlenmesine itiraz etme gibi haklara sahip olabilirsin. Talepler için ${supportEmail} adresine yaz. [Bu bölüm yayından önce KVKK (ve hedefleniyorsa GDPR) kapsamındaki haklar ve başvuru yöntemleriyle bir hukukçu tarafından tamamlanmalıdır.]`,
          ],
        },
        {
          heading: 'Değişiklikler',
          paragraphs: ['Bu politikada önemli bir değişiklik olursa, yürürlüğe girmeden önce seni uygulama içinde bilgilendiririz.'],
        },
        {
          heading: 'İletişim',
          paragraphs: [`${supportEmail} — gizlilik soruları, veri talepleri ve güvenlik bildirimleri için.`],
        },
      ],
    };
  }

  return {
    sections: [
      {
        heading: 'Who we are',
        paragraphs: [
          `Cellar is a cocktail recipe, discovery and home-bar app. Data controller: ${entity}, ${address} (${jurisdiction}). Contact: ${supportEmail}.`,
        ],
      },
      {
        heading: 'Without an account',
        paragraphs: [
          'Browsing the catalog, search, filters, ingredient matching, favorites, My Bar, the tasting journal, the shopping list and personal (private) recipes all work entirely on your device. That data is stored on your device and is not sent to us or anyone else unless you create an account and choose to publish something.',
        ],
      },
      {
        heading: 'What we process if you create an account',
        paragraphs: ['Creating an account or publishing a recipe sends the following to our infrastructure provider, Supabase:'],
        bullets: [
          'Account: your email address, username, display name and optional bio.',
          'Authentication: if you sign up with a password, Supabase stores a securely hashed credential — we never see your raw password. If you sign in with Apple or Google, we receive the provider’s verified user ID and the name/email you choose to share (including an Apple “Hide My Email” relay address).',
          'Published (public) recipes: name, description, ingredients, method, steps and any photo you attach — visible to everyone using the app.',
          'Social activity: who you follow, who follows you, the recipes you like, and the users you block (your block list is visible only to you).',
          'Reports: if you report a recipe or user, we store the report and your account ID.',
          'Purchases: if you buy Premium, our billing provider RevenueCat (on top of the Apple App Store / Google Play) records your subscription status together with your account ID. A copy of your Premium status (whether it is active, the plan and when it last changed) is also kept in our Supabase database. We never receive your payment card details.',
        ],
      },
      {
        heading: 'Photos',
        paragraphs: [
          'When you add a photo to a recipe, the system photo picker is used — the app only receives the photo you select, not your photo library. The photo is resized and saved on your device. A photo on a private recipe stays on your device; a photo on a recipe you publish is uploaded to our storage so other users can see it.',
        ],
      },
      {
        heading: 'Crash reports',
        paragraphs: [
          'If the app crashes or hits an error, and this feature is enabled, error details (the error message, app version, device model, operating system and, if signed in, your pseudonymous account ID — a random identifier that does not contain your name or email) are sent to our error-monitoring service, Sentry. Recipe content, email addresses, passwords and session tokens are not sent.',
        ],
      },
      {
        heading: 'Services that process your data',
        paragraphs: ['These services process data on our behalf. Some may process it outside the EU (for example in the United States).', 'Like any internet service, they also receive your device’s IP address when the app connects to them.'],
        bullets: [
          `Supabase — database, authentication, file storage and the account-deletion function (hosting region: ${dataRegion}).`,
          'RevenueCat — purchase and subscription status.',
          'Apple / Google — only if you choose “Continue with Apple” or “Continue with Google”; what they see about that sign-in is governed by their own privacy policies.',
          'Sentry — crash reports (if enabled).',
        ],
      },
      {
        heading: 'No ads or tracking',
        paragraphs: [
          'Cellar shows no ads, uses no third-party analytics or tracking tools, and does not sell your data. If that ever changes, this section and the App Store / Google Play privacy declarations will be updated before the change ships.',
        ],
      },
      {
        heading: 'Retention and account deletion',
        paragraphs: [
          'Account data is kept until you delete your account. You can permanently delete it at any time in the app under Profile → Delete account. This deletes your sign-in identity, profile, published recipes and their photos, likes, follows and blocks from our servers, and — if you use Sign in with Apple — revokes Cellar’s access to your Apple ID. We also ask RevenueCat to delete the purchase-status record linked to your account; the store’s own purchase history stays with Apple / Google. Reports kept as moderation records are retained without being linked to you. Deleted data may remain in our providers’ backups for a limited period. Data kept only on your device stays there until you delete the app.',
        ],
      },
      {
        heading: 'Age',
        paragraphs: ['Cellar contains alcoholic cocktail recipes and is not directed at anyone under the legal drinking age where they live.'],
      },
      {
        heading: 'Your rights',
        paragraphs: [
          `You may have rights to access, correct, delete or object to the processing of your personal data. Send requests to ${supportEmail}. [Before publication, a lawyer must complete this section for the applicable law — KVKK for Türkiye, and GDPR if EU users are targeted.]`,
        ],
      },
      {
        heading: 'Changes',
        paragraphs: ['If this policy changes in a material way, we will tell you in the app before the change takes effect.'],
      },
      {
        heading: 'Contact',
        paragraphs: [`${supportEmail} — for privacy questions, data requests and security reports.`],
      },
    ],
  };
}
