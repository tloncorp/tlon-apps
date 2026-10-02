// @p syllable tables from @urbit/aura (`pre`/`suf`), vendored because the
// package does not export them.
const PREFIXES =
  'dozmarbinwansamlitsighidfidlissogdirwacsabwissib' +
  'rigsoldopmodfoglidhopdardorlorhodfolrintogsilmir' +
  'holpaslacrovlivdalsatlibtabhanticpidtorbolfosdot' +
  'losdilforpilramtirwintadbicdifrocwidbisdasmidlop' +
  'rilnardapmolsanlocnovsitnidtipsicropwitnatpanmin' +
  'ritpodmottamtolsavposnapnopsomfinfonbanmorworsip' +
  'ronnorbotwicsocwatdolmagpicdavbidbaltimtasmallig' +
  'sivtagpadsaldivdactansidfabtarmonranniswolmispal' +
  'lasdismaprabtobrollatlonnodnavfignomnibpagsopral' +
  'bilhaddocridmocpacravripfaltodtiltinhapmicfanpat' +
  'taclabmogsimsonpinlomrictapfirhasbosbatpochactid' +
  'havsaplindibhosdabbitbarracparloddosbortochilmac' +
  'tomdigfilfasmithobharmighinradmashalraglagfadtop' +
  'mophabnilnosmilfopfamdatnoldinhatnacrisfotribhoc' +
  'nimlarfitwalrapsarnalmoslandondanladdovrivbacpol' +
  'laptalpitnambonrostonfodponsovnocsorlavmatmipfip';

const SUFFIXES =
  'zodnecbudwessevpersutletfulpensytdurwepserwylsun' +
  'rypsyxdyrnuphebpeglupdepdysputlughecryttyvsydnex' +
  'lunmeplutseppesdelsulpedtemledtulmetwenbynhexfeb' +
  'pyldulhetmevruttylwydtepbesdexsefwycburderneppur' +
  'rysrebdennutsubpetrulsynregtydsupsemwynrecmegnet' +
  'secmulnymtevwebsummutnyxrextebfushepbenmuswyxsym' +
  'selrucdecwexsyrwetdylmynmesdetbetbeltuxtugmyrpel' +
  'syptermebsetdutdegtexsurfeltudnuxruxrenwytnubmed' +
  'lytdusnebrumtynseglyxpunresredfunrevrefmectedrus' +
  'bexlebduxrynnumpyxrygryxfeptyrtustyclegnemfermer' +
  'tenlusnussyltecmexpubrymtucfyllepdebbermughuttun' +
  'bylsudpemdevlurdefbusbeprunmelpexdytbyttyplevmyl' +
  'wedducfurfexnulluclennerlexrupnedlecrydlydfenwel' +
  'nydhusrelrudneshesfetdesretdunlernyrsebhulryllud' +
  'remlysfynwerrycsugnysnyllyndyndemluxfedsedbecmun' +
  'lyrtesmudnytbyrsenwegfyrmurtelreptegpecnelnevfes';

const prefixes = new Set(PREFIXES.match(/.{3}/g));
const suffixes = new Set(SUFFIXES.match(/.{3}/g));

// Per-syllable check only, deliberately not @urbit/aura `valid('p')`: its
// canonical round-trip rejects leading-zero moons such as
// ~dozzod-dozzod-sampel-palnet that real test ships use.
export function hasValidPatpSyllables(name: string): boolean {
  const letters = name.replace(/[~-]/g, '');
  if (letters.length === 3) return suffixes.has(letters);
  if (letters.length === 0 || letters.length % 6 !== 0) return false;
  for (let i = 0; i < letters.length; i += 6) {
    if (
      !prefixes.has(letters.slice(i, i + 3)) ||
      !suffixes.has(letters.slice(i + 3, i + 6))
    ) {
      return false;
    }
  }
  return true;
}
