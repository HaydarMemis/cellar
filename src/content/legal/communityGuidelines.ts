import { Locale } from '../../i18n/types';
import { legalFields } from './fields';
import { LegalDoc } from './types';

/**
 * Describes the moderation tools that actually exist (report reasons from
 * ModerationBackend, block, follow) — no comments/DMs exist, so none are
 * mentioned. Keep EN and TR in sync.
 */
export function getCommunityGuidelines(locale: Locale = 'en'): LegalDoc {
  const { supportEmail } = legalFields(locale);
  if (locale === 'tr') {
    return {
      sections: [
        { heading: 'Bu kurallar neden var', paragraphs: ['Cellar’da kendi tariflerini yayınlayabilir, diğer ev barmenlerini takip edebilir ve yaptıklarını beğenebilirsin. Bu kurallar Cellar’da “herkese açık” olmanın ne anlama geldiğini ve uygunsuz bir şeyi nasıl bildireceğini anlatır.'] },
        { heading: 'Bir tarif yayınladığında', paragraphs: ['Herkese açık olarak işaretlediğin bir tarif, profilinde ve Keşfet’te Cellar kullanan herkese görünür. Yalnızca hakkına sahip olduğun tarifleri ve fotoğrafları yayınla. İçeriği içeceğe odaklı tut: malzemeler, yöntem ve onu yapmaya değer kılan şey.'] },
        {
          heading: 'İzin verilmeyenler',
          paragraphs: ['Aşağıdakilerden herhangi birini içeren içerik veya davranışa Cellar’da izin verilmez:'],
          bullets: [
            'Taciz, nefret söylemi veya başka bir kullanıcıya yönelik hedefli kötüye kullanım',
            'Başka bir kişinin veya markanın kimliğine bürünme',
            'Spam veya aynı tarifi tekrar tekrar yayınlama',
            'Telif hakkı ihlali — sana ait olmayan bir tarif, açıklama veya fotoğrafı yayınlama',
            'Yasa dışı her şey veya yasal alkol yaşının altındakilere yönelik içerik',
          ],
        },
        { heading: 'Şikâyet etme', paragraphs: ['Bir tarifi veya kullanıcıyı “…” menüsünden şikâyet edebilirsin. Uygun nedeni (spam, uygunsuz içerik, taciz, telif hakkı veya diğer) seç ve yardımcı olacaksa ayrıntı ekle. Şikâyetler kötüye kullanılmasın diye hesabına bağlıdır ve tarafımızdan incelenir.'] },
        { heading: 'Engelleme', paragraphs: ['Birini profilinden engellediğinde herkese açık tarifleri Keşfet akışından hemen kaybolur ve seninle etkileşime giremez (beğenme, takip etme). Engellediğin kişiye bildirim gitmez. Bunu istediğin zaman Profil → Gizlilik ve Topluluk → Engellenen kullanıcılar bölümünden geri alabilirsin.'] },
        { heading: 'Şikâyetten sonra', paragraphs: [`Şikâyetleri 24 saat içinde incelemeyi hedefleriz; doğrulanan bir ihlal içeriğin kaldırılmasına ve hesabın askıya alınmasına veya kapatılmasına yol açabilir. Acil bir durum için ${supportEmail} adresine yazabilirsin.`] },
      ],
    };
  }
  return {
    sections: [
      { heading: 'Why this exists', paragraphs: ['Cellar lets you publish your own recipes, follow other home bartenders, and like what they make. These guidelines cover what “public” means on Cellar and how to report something that shouldn’t be there.'] },
      { heading: 'When you publish a recipe', paragraphs: ['A recipe you mark Public is visible to anyone using Cellar, on your profile and in Discover. Only publish recipes and photos you have the rights to. Keep it about the drink — the ingredients, the method, and what makes it worth making.'] },
      {
        heading: 'Not allowed',
        paragraphs: ['Content or behavior that includes any of the following isn’t allowed on Cellar:'],
        bullets: [
          'Harassment, hate speech, or targeted abuse of another user',
          'Impersonating another person or brand',
          'Spam, or repeatedly publishing the same recipe',
          'Copyright infringement — publishing a recipe, description or photo that isn’t yours to publish',
          'Anything illegal, or content aimed at anyone under the legal drinking age',
        ],
      },
      { heading: 'Reporting something', paragraphs: ['You can report a recipe or a user from its “…” menu. Choose the reason that fits — spam, inappropriate content, harassment, copyright, or something else — and add details if it helps. Reports are tied to your account so they can’t be used to mass-target someone, and are reviewed by us.'] },
      { heading: 'Blocking', paragraphs: ['Blocking someone from their profile immediately hides their public recipes from your Discover feed and stops them from interacting with you (liking, following). They aren’t notified. You can undo it any time from Profile → Privacy & Community → Blocked users.'] },
      { heading: 'What happens after a report', paragraphs: [`We aim to review reports within 24 hours; a confirmed violation can lead to the content being removed and the account being suspended or terminated. For anything urgent, contact ${supportEmail}.`] },
    ],
  };
}
