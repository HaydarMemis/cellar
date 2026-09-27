import { Locale } from '../../i18n/types';
import { legalFields } from './fields';
import { LegalDoc } from './types';

/** DRAFT until reviewed by a lawyer. Keep EN and TR in sync. */
export function getTermsOfService(locale: Locale = 'en'): LegalDoc {
  const { entity, jurisdiction, supportEmail } = legalFields(locale);
  if (locale === 'tr') {
    return {
      sections: [
        { heading: 'Taraflar', paragraphs: [`Bu Kullanım Koşulları, sen ile Cellar uygulamasının yayıncısı ${entity} (“Cellar”, “biz”) arasındadır.`] },
        {
          heading: 'Yaş ve alkol',
          paragraphs: [
            'Cellar alkollü kokteyl tarifleri ve bilgileri içerir. Cellar’ı kullanarak bulunduğun yerdeki yasal alkol tüketme yaşının üzerinde olduğunu onaylarsın. Cellar alkol satmaz veya teslim etmez; yalnızca tarif ve başvuru bilgisi sunar. Sorumlu tüket.',
          ],
        },
        {
          heading: 'Hesaplar',
          paragraphs: [
            'Hesap bilgilerinin güvenliğinden sen sorumlusun. Hesabını istediğin zaman uygulama içinden (Profil → Hesabı sil) silebilirsin; neyin silindiği Gizlilik Politikası’nda açıklanmıştır.',
          ],
        },
        {
          heading: 'Kullanıcı içerikleri',
          paragraphs: [
            'Yayınladığın tarif ve fotoğrafların sahibi sen olmaya devam edersin; ancak yayında kaldıkları sürece bunları uygulama içinde diğer kullanıcılara göstermemiz için Cellar’a bir lisans vermiş olursun. Hakkına sahip olmadığın, başkalarının haklarını ihlal eden veya Topluluk Kuralları’na aykırı hiçbir şey yayınlama.',
          ],
        },
        {
          heading: 'Kabul edilemez içerik',
          paragraphs: [
            'Taciz, nefret söylemi, spam, başkasının kimliğine bürünme ve yasa dışı içerik yasaktır; bu tür içeriklere karşı sıfır tolerans uygularız. Cellar uygulama içinde şikâyet etme ve engelleme araçları sunar. Kurallara aykırı içerikler kaldırılabilir ve hesaplar askıya alınabilir veya kapatılabilir.',
          ],
        },
        {
          heading: 'Premium abonelikler',
          paragraphs: [
            'Premium; otomatik yenilenen aylık/yıllık abonelikler veya tek seferlik ömür boyu satın alma olarak sunulur ve Apple App Store ya da Google Play üzerinden faturalandırılır. Fiyat, satın alma anında mağazada gösterilen fiyattır. Abonelikler, mevcut dönemin bitiminden en az 24 saat önce Apple kimliği / Google hesabı abonelik ayarlarından iptal edilmedikçe otomatik olarak yenilenir. İadeler Apple ve Google’ın kendi politikalarına tabidir.',
          ],
        },
        {
          heading: 'Sorumluluk reddi',
          paragraphs: ['Cellar bilgileri başvuru amaçlıdır; alkol oranları her zaman yaklaşık değerlerdir. Uygulama “olduğu gibi” sunulur; yürürlükteki hukukun izin verdiği ölçüde her türlü garanti reddedilir.'],
        },
        { heading: 'Fesih', paragraphs: ['Bu koşulları veya Topluluk Kuralları’nı ihlal eden hesapları askıya alabilir veya kapatabiliriz.'] },
        { heading: 'Uygulanacak hukuk', paragraphs: [`Bu koşullara ${jurisdiction} hukuku uygulanır.`] },
        { heading: 'Değişiklikler', paragraphs: ['Bu koşulları zaman zaman güncelleyebiliriz; önemli değişiklikleri uygulama içinde bildiririz.'] },
        { heading: 'İletişim', paragraphs: [supportEmail] },
      ],
    };
  }
  return {
    sections: [
      { heading: 'Who these terms are between', paragraphs: [`These Terms of Service are between you and ${entity}, the publisher of the Cellar app (“Cellar”, “we”, “us”).`] },
      {
        heading: 'Age and alcohol',
        paragraphs: [
          'Cellar contains recipes and information about alcoholic cocktails. By using Cellar you confirm you are at least the legal drinking age where you live. Cellar does not sell or deliver alcohol; it provides recipe and reference information only. Please drink responsibly.',
        ],
      },
      {
        heading: 'Accounts',
        paragraphs: [
          'You are responsible for keeping your account credentials secure. You can delete your account at any time in the app (Profile → Delete account); the Privacy Policy explains exactly what that removes.',
        ],
      },
      {
        heading: 'User-generated content',
        paragraphs: [
          'You keep ownership of recipes and photos you publish, but grant Cellar a license to display them to other users in the app for as long as they stay published. Don’t publish anything you don’t have the rights to, anything that infringes someone else’s rights, or anything that breaks the Community Guidelines.',
        ],
      },
      {
        heading: 'Objectionable content',
        paragraphs: [
          'Harassment, hate speech, spam, impersonation and illegal content are not allowed, and we have zero tolerance for them. Cellar provides in-app reporting and blocking. Violating content may be removed and accounts suspended or terminated.',
        ],
      },
      {
        heading: 'Premium subscriptions',
        paragraphs: [
          'Premium is offered as auto-renewing monthly/yearly subscriptions or a one-time lifetime purchase, billed through the Apple App Store or Google Play. The price is the one shown by the store at the time of purchase. Subscriptions renew automatically unless cancelled at least 24 hours before the end of the current period in your Apple ID / Google account subscription settings. Refunds are governed by Apple’s and Google’s own policies.',
        ],
      },
      {
        heading: 'Disclaimer',
        paragraphs: ['Cellar provides cocktail information for reference; ABV figures are always approximate. The app is provided “as is”, without warranties to the extent permitted by applicable law.'],
      },
      { heading: 'Termination', paragraphs: ['We may suspend or terminate accounts that violate these terms or the Community Guidelines.'] },
      { heading: 'Governing law', paragraphs: [`These terms are governed by the laws of ${jurisdiction}.`] },
      { heading: 'Changes', paragraphs: ['We may update these terms from time to time; material changes will be announced in the app.'] },
      { heading: 'Contact', paragraphs: [supportEmail] },
    ],
  };
}
