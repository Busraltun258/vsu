/**
 * ════════════════════════════════════════════════════════════════════
 *  VCU — PAYLAŞILAN ÇEKİRDEK
 *
 *  Üç sayfa (GESB matrisi, ADU "Bu Ekran", Video Kayıt) aynı tipleri,
 *  aynı sahte veriyi, aynı temayı ve aynı bileşen dilini kullanır. Hepsi
 *  burada durur ki sayfalar arasında görsel/işlevsel kayma olmasın.
 *
 *  Dış bağımlılık yalnızca antd/@ant-design/icons/dayjs — uygulamanın
 *  başka hiçbir yerine referans yok. Backend'e bağlı değil; gerçek video
 *  matrix/kayıt entegrasyonu geldiğinde "SAHTE VERİ" bölümünün yerini bir
 *  API client'ı alır.
 * ════════════════════════════════════════════════════════════════════ */

import {
  AimOutlined,
  AppstoreOutlined,
  CheckOutlined,
  CloseOutlined,
  DesktopOutlined,
  FastBackwardOutlined,
  FastForwardOutlined,
  MoonOutlined,
  PlaySquareOutlined,
  PlusOutlined,
  RadarChartOutlined,
  SearchOutlined,
  SunOutlined,
  TagsOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons"
import {
  Badge,
  Button,
  DatePicker,
  Input,
  List,
  Segmented,
  Select,
  Slider,
  Tag,
  Tooltip,
  Typography,
  theme as antdTheme,
  type ThemeConfig,
} from "antd"
import dayjs from "dayjs"
import {
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react"

const { useToken } = antdTheme
const { Text } = Typography
const { RangePicker } = DatePicker

/* ════════════════════════════════════════════════════════════════════
 *  TİPLER
 * ════════════════════════════════════════════════════════════════════ */

export type VcuVideoKind = "recorded" | "live"

/** Canlı akışın geldiği donanım türü. */
export type VcuLiveSourceType = "camera" | "sensor" | "radar"

export type VcuVideoSource = {
  id: string
  name: string
  kind: VcuVideoKind
  /** Sadece kayıtlı videolarda anlamlı. */
  duration?: string
  /** ISO tarih (YYYY-MM-DD). Sadece kayıtlı videolarda var — canlı kameraların "tarihi" olmaz. */
  date?: string
  /** Sadece canlı kaynaklarda var — kayıtlı videoların donanım türü olmaz. */
  sourceType?: VcuLiveSourceType
  /** Kayıt sırasında operatörün eklediği etiketler. Sadece kayıtlı videolarda. */
  tags?: string[]
}

export type VcuGesbStatus = "offline" | "idle" | "loaded" | "live"
export type VcuLayout = "single" | "quad"

/**
 * Kayıtlı bir slotun oynatma konumu/hızı. Canlı kaynakta anlamı yok —
 * transport çubuğu yalnızca KAYITLI içerikte gösterilir. "Oynuyor mu" AYRI
 * bir alan değil: bir hedef `status === "live"` olduğu sürece yüklü tüm
 * slotları oynatıyor sayılır, `status` değilse hepsi duraklamış sayılır.
 * Tek "oynat/durdur" anahtarı budur — GESB/ADU kartındaki Yayınla/Durdur
 * düğmesi. Transport çubuğunda AYRICA bir oynat/duraklat yok (kafa
 * karıştırıyordu); çubuk yalnızca konum + hız + ±sarma sunar.
 *
 * İKİ FAZ:
 *  · Yayın öncesi (status !== "live") → YEREL ÖNİZLEME. Operatör VCU'da sarar,
 *    hızını ayarlar; hedef ekrana hiçbir şey gitmez. "Yayınla" bu konumu ve
 *    hızı kaynak listesiyle birlikte TEK ATIŞTA gönderir.
 *  · Yayındayken (status === "live") → CANLI KONTROL. Her yerleşmiş etkileşim
 *    hedefe ANLIK tek bir istek olur (POST /api/playback/control). Sürekli
 *    döngü/stream YOK: slider sürüklenirken istek gitmez, parmak kalkınca bir
 *    tane gider (bkz. VcuTransportBar'daki dragValue).
 */
export type VcuTransport = {
  /** Saniye cinsinden mevcut konum. */
  position: number
  /** Oynatma hızı çarpanı. */
  rate: number
}

export const DEFAULT_TRANSPORT: VcuTransport = { position: 0, rate: 1 }

/** 4 slot için birbirinden bağımsız, TAZE transport nesneleri (referans paylaşmasın diye). */
export function defaultTransports(): VcuTransport[] {
  return [0, 1, 2, 3].map(() => ({ ...DEFAULT_TRANSPORT }))
}

/** Transport çubuğundaki hız seçenekleri. */
export const TRANSPORT_RATES = [0.5, 1, 2, 4]

/** ±sarma adımı (saniye). */
export const TRANSPORT_STEP_SECONDS = 10

export type VcuGesb = {
  id: string
  name: string
  location: string
  status: VcuGesbStatus
  layout: VcuLayout
  /** 4 slot — single modda sadece slots[0] anlamlı. */
  slots: (string | null)[]
  /**
   * Slotlarla index hizalı — her bölme kendi konum/hızını taşır, DÖRTLÜDE
   * BAĞIMSIZ sarılır. Izgarada bir videoya dokunmak "aktif bölme"yi değiştirir,
   * transport çubuğu o bölmeye döner (bkz. GesbMatrixPage activeSlotIndex).
   */
  transports: VcuTransport[]
}

export type VcuDatePreset = "all" | "today" | "week" | "month" | "custom"

export type VcuDateRange = {
  preset: VcuDatePreset
  customStart: string | null
  customEnd: string | null
}

export type VcuThemeMode = "dark" | "light"

/**
 * ADU (operatörün kendi ekranı) tek bir "hedef" — bir GESB gibi ama kimliği,
 * konumu ve çevrimdışı hâli yok; hep var, hep kendi ekranı. Aynı slot/layout
 * şeklini kullanıyor ki VcuSlotsPreview'ı GESB kartıyla paylaşabilelim.
 */
export type VcuOwnScreen = {
  status: "idle" | "loaded" | "live"
  layout: VcuLayout
  slots: (string | null)[]
  /** bkz. VcuGesb.transports — slotlarla index hizalı, dörtlüde bağımsız sarma. */
  transports: VcuTransport[]
}

/** Kayıt alınabilen kaynak türü — canlı türlerine ek olarak operatör konsolları (opcon). */
export type VcuRecordSourceType = "opcon" | VcuLiveSourceType

export type VcuRecordSource = {
  id: string
  name: string
  type: VcuRecordSourceType
  location: string
  /** Çevrimdışı kaynaktan kayıt başlatılamaz. */
  online: boolean
}

/** Devam eden bir kayıt. Etiketler kayıt BAŞLARKEN girilir, sonradan değişmez. */
export type VcuRecording = {
  sourceId: string
  /** epoch ms — geçen süre bundan hesaplanır. */
  startedAt: number
  tags: string[]
  /**
   * Kayıt başlarken seçilen süre (saniye). 0 / verilmemiş → SÜRESİZ: kayıt
   * yalnızca operatör durdurunca biter. Doluysa süre dolunca kayıt
   * KENDİLİĞİNDEN durur (bkz. VideoRecordingPage'deki otomatik durdurma
   * efekti); operatör isterse daha erken de durdurabilir.
   */
  plannedSeconds?: number
}

/** Uygulamanın sayfaları. Her biri ayrı bir ekran, ortak kabuğu paylaşır. */
export type VcuPageKey = "gesb" | "adu" | "record"

/**
 * Cihazın rolü — arayüzün hangi parçalarını göreceğini belirler:
 *  · control-unit → 10.1" tablet; GESB matrisini sürer, KAYIT ALMAZ
 *  · operator     → normal bilgisayar; kendi ekranı (ADU) + video kayıt
 *
 * Video kayıt ekranı cihaza bağlı DEĞİL: rolü ne olursa olsun kendi
 * adresinden (bkz. vcuPageHref) herhangi bir bilgisayardan açılabilir.
 * Rol yalnızca "ADU'da Video Kayıt düğmesi çıksın mı" sorusunu yanıtlar.
 *
 * GEÇİCİ: rol şu an pencere genişliğinden tahmin ediliyor; sunucudan gelmeli
 * (bkz. docs/VSU_BACKEND_API.md soru 13).
 */
export type VcuRole = "control-unit" | "operator"

/**
 * Sayfa ↔ adres eşlemesi. Her sayfanın GERÇEK bir adresi var: müşteri isteği
 * gereği video kayıt ekranı ayrı bir tarayıcı sekmesinde açılıyor, bu da
 * ancak doğrudan açılabilen bir adresle mümkün.
 *
 * React Router BİLEREK eklenmedi — üç adres için history API yeterli, yeni
 * bağımlılık taşımıyoruz. nginx zaten `try_files ... /index.html` yaptığı
 * için derin adres yenilendiğinde kırılmaz (bkz. apps/vsu/nginx.conf).
 */
const PAGE_PATH_SEGMENTS: Record<VcuPageKey, string> = {
  gesb: "",
  adu: "adu",
  record: "kayit",
}

/** Sayfanın tam adresi (uygulama kökü dahil) — bağlantı vermek için. */
export function vcuPageHref(page: VcuPageKey): string {
  return `${import.meta.env.BASE_URL}${PAGE_PATH_SEGMENTS[page]}`
}

/**
 * Adres çubuğundaki yolun işaret ettiği sayfa. Kök adres ("/") bilerek null
 * döner: orada hangi sayfanın açılacağına cihazın rolü karar verir.
 */
export function vcuPageFromLocation(): VcuPageKey | null {
  const base = import.meta.env.BASE_URL
  const path = window.location.pathname
  const relative = (path.startsWith(base) ? path.slice(base.length) : path).replace(
    /^\/+|\/+$/g,
    "",
  )
  if (relative === PAGE_PATH_SEGMENTS.adu) return "adu"
  if (relative === PAGE_PATH_SEGMENTS.record) return "record"
  return null
}

/* ════════════════════════════════════════════════════════════════════
 *  KAYNAK TÜRLERİ (kamera / sensör / radar / opcon)
 * ════════════════════════════════════════════════════════════════════ */

type VcuSourceMeta = { label: string; short: string; color: string; icon: ReactNode }

export const LIVE_SOURCE_META: Record<VcuLiveSourceType, VcuSourceMeta> = {
  camera: { label: "Kamera", short: "KAMERA", color: "red", icon: <VideoCameraOutlined /> },
  sensor: { label: "Sensör", short: "SENSÖR", color: "gold", icon: <AimOutlined /> },
  radar: { label: "Radar", short: "RADAR", color: "cyan", icon: <RadarChartOutlined /> },
}

export const RECORD_SOURCE_META: Record<VcuRecordSourceType, VcuSourceMeta> = {
  opcon: { label: "Opcon", short: "OPCON", color: "purple", icon: <DesktopOutlined /> },
  ...LIVE_SOURCE_META,
}

export const LIVE_SOURCE_ORDER: VcuLiveSourceType[] = ["camera", "sensor", "radar"]
export const RECORD_SOURCE_ORDER: VcuRecordSourceType[] = ["opcon", "camera", "sensor", "radar"]

/** Canlı kaynağın tür bilgisi; kayıtlı videolarda (ya da türü belirtilmemişse) null. */
export function liveSourceMeta(video: VcuVideoSource): VcuSourceMeta | null {
  if (video.kind !== "live" || !video.sourceType) return null
  return LIVE_SOURCE_META[video.sourceType]
}

/* ════════════════════════════════════════════════════════════════════
 *  SAHTE VERİ
 * ════════════════════════════════════════════════════════════════════ */

export const initialVideos: VcuVideoSource[] = [
  {
    id: "v1",
    name: "Opcon 1",
    kind: "recorded",
    duration: "04:12",
    date: "2026-09-06",
    tags: ["Operasyon", "Brifing"],
  },
  {
    id: "v2",
    name: "Opcon 2",
    kind: "recorded",
    duration: "01:45",
    date: "2026-09-02",
    tags: ["Tatbikat"],
  },
  {
    id: "v3",
    name: "Opcon 3",
    kind: "recorded",
    duration: "06:30",
    date: "2026-09-05",
    tags: ["Operasyon"],
  },
  { id: "v4", name: "Kamera 01 · Ana Sahne", kind: "live", sourceType: "camera" },
  { id: "v5", name: "Sensör 02 · Ana Sahne", kind: "live", sourceType: "sensor" },
  { id: "v6", name: "Kamera 03 · Salon Genel", kind: "live", sourceType: "camera" },
  {
    id: "v7",
    name: "Opcon 4",
    kind: "recorded",
    duration: "03:05",
    date: "2026-09-01",
    tags: ["Eğitim"],
  },
  {
    id: "v8",
    name: "Opcon 5",
    kind: "recorded",
    duration: "08:20",
    date: "2026-08-15",
    tags: ["Tatbikat", "Gece Görüşü"],
  },
  { id: "v9", name: "Sensör 04 · Fuaye", kind: "live", sourceType: "sensor" },
  {
    id: "v10",
    name: "Katılımcı Anket Sonuçları",
    kind: "recorded",
    duration: "02:15",
    date: "2026-09-03",
    tags: ["Brifing"],
  },
  {
    id: "v11",
    name: "Sahne Arkası Görüntüleri",
    kind: "recorded",
    duration: "05:50",
    date: "2026-07-20",
    tags: ["Test"],
  },
  { id: "v12", name: "Kamera 05 · Giriş Holü", kind: "live", sourceType: "camera" },
  { id: "v13", name: "Radar 06 · Çevre Hattı", kind: "live", sourceType: "radar" },
  { id: "v14", name: "Radar 07 · Kuzey Sektör", kind: "live", sourceType: "radar" },
]

export const initialGesbs: VcuGesb[] = [
  {
    id: "g1",
    name: "GESB 1",
    location: "Ana Sahne Arkası",
    status: "live",
    layout: "single",
    slots: ["v4", null, null, null],
    transports: defaultTransports(),
  },
  {
    // Bir GESB ya canlı ya kayıtlı taşır (bkz. selectionKind kısıtı) — bu kart
    // kayıtlı tarafı örnekliyor, g1 canlı tarafı. Kayıtlı DAİMA tekli
    // (bkz. maxSelectableFor); dörtlü örneği için g3'e bak.
    id: "g2",
    name: "GESB 2",
    location: "Sol Fuaye",
    status: "loaded",
    layout: "single",
    slots: ["v1", null, null, null],
    // Kayıtlı içerik: yayına 72. saniyeden hazır (bkz. transport çubuğu).
    transports: [
      { position: 72, rate: 1 },
      { ...DEFAULT_TRANSPORT },
      { ...DEFAULT_TRANSPORT },
      { ...DEFAULT_TRANSPORT },
    ],
  },
  {
    // Dörtlü örneği — yalnızca CANLI kaynaklarla mümkün.
    id: "g3",
    name: "GESB 3",
    location: "Sağ Fuaye",
    status: "loaded",
    layout: "quad",
    slots: ["v4", "v5", "v6", "v13"],
    // Canlı kaynakta zaman çizgisi yok; transportlar kullanılmaz.
    transports: defaultTransports(),
  },
  {
    id: "g4",
    name: "GESB 4",
    location: "VIP Lounge",
    status: "offline",
    layout: "single",
    slots: [null, null, null, null],
    transports: defaultTransports(),
  },
  {
    id: "g5",
    name: "GESB 5",
    location: "Basın Odası",
    status: "idle",
    layout: "single",
    slots: [null, null, null, null],
    transports: defaultTransports(),
  },
  {
    id: "g6",
    name: "GESB 6",
    location: "Giriş Holü",
    status: "idle",
    layout: "single",
    slots: [null, null, null, null],
    transports: defaultTransports(),
  },
]

export const initialRecordSources: VcuRecordSource[] = [
  { id: "s1", name: "Opcon 1 · Komuta Masası", type: "opcon", location: "Kontrol Odası", online: true },
  { id: "s2", name: "Opcon 2 · Harita Konsolu", type: "opcon", location: "Kontrol Odası", online: true },
  { id: "s3", name: "Opcon 3 · Silah Konsolu", type: "opcon", location: "Kontrol Odası", online: false },
  { id: "s4", name: "Kamera 01 · Ana Sahne", type: "camera", location: "Ana Sahne", online: true },
  { id: "s5", name: "Kamera 03 · Salon Genel", type: "camera", location: "Salon", online: true },
  { id: "s6", name: "Kamera 05 · Giriş Holü", type: "camera", location: "Giriş Holü", online: true },
  { id: "s7", name: "Sensör 02 · Ana Sahne", type: "sensor", location: "Ana Sahne", online: true },
  { id: "s8", name: "Sensör 04 · Fuaye", type: "sensor", location: "Fuaye", online: true },
  { id: "s9", name: "Radar 06 · Çevre Hattı", type: "radar", location: "Çevre Hattı", online: true },
  { id: "s10", name: "Radar 07 · Kuzey Sektör", type: "radar", location: "Kuzey Sektör", online: false },
  // s11-s30: Video Kayıt sayfasının yatay sayfalı şeridini (30+ kaynak
  // senaryosu) gerçekçi biçimde test etmek için — bkz. VideoRecordingPage.
  { id: "s11", name: "Opcon 4 · Yedek Konsol", type: "opcon", location: "Kontrol Odası", online: true },
  { id: "s12", name: "Opcon 5 · Eğitim Konsolu", type: "opcon", location: "Eğitim Salonu", online: true },
  { id: "s13", name: "Kamera 06 · Sağ Fuaye", type: "camera", location: "Sağ Fuaye", online: true },
  { id: "s14", name: "Kamera 07 · Sol Fuaye", type: "camera", location: "Sol Fuaye", online: true },
  { id: "s15", name: "Kamera 08 · VIP Lounge", type: "camera", location: "VIP Lounge", online: true },
  { id: "s16", name: "Kamera 09 · Basın Odası", type: "camera", location: "Basın Odası", online: false },
  { id: "s17", name: "Kamera 10 · Otopark", type: "camera", location: "Otopark", online: true },
  { id: "s18", name: "Kamera 11 · Servis Girişi", type: "camera", location: "Servis Girişi", online: true },
  { id: "s19", name: "Sensör 05 · Sağ Fuaye", type: "sensor", location: "Sağ Fuaye", online: true },
  { id: "s20", name: "Sensör 06 · VIP Lounge", type: "sensor", location: "VIP Lounge", online: true },
  { id: "s21", name: "Sensör 07 · Otopark", type: "sensor", location: "Otopark", online: false },
  { id: "s22", name: "Sensör 08 · Servis Girişi", type: "sensor", location: "Servis Girişi", online: true },
  { id: "s23", name: "Radar 08 · Güney Sektör", type: "radar", location: "Güney Sektör", online: true },
  { id: "s24", name: "Radar 09 · Doğu Sektör", type: "radar", location: "Doğu Sektör", online: true },
  { id: "s25", name: "Radar 10 · Batı Sektör", type: "radar", location: "Batı Sektör", online: true },
  { id: "s26", name: "Kamera 12 · Basın Toplantı Salonu", type: "camera", location: "Basın Salonu", online: true },
  { id: "s27", name: "Kamera 13 · Ana Giriş Dış", type: "camera", location: "Ana Giriş", online: true },
  { id: "s28", name: "Sensör 09 · Ana Giriş", type: "sensor", location: "Ana Giriş", online: true },
  { id: "s29", name: "Radar 11 · Liman Hattı", type: "radar", location: "Liman Hattı", online: false },
  { id: "s30", name: "Opcon 6 · Gözlem Konsolu", type: "opcon", location: "Gözlem Kulesi", online: true },
]

// Hazır etiket önerisi listesi BİLEREK YOK. Kullanıcı geri bildirimi: baştan
// dolu bir öneri listesi istenmiyor. Etiket kutusu boş açılır ve operatörün
// bu oturumda yazdığı etiketlerle dolar (bkz. VideoRecordingPage/knownTags).

/** Bir kayda eklenebilecek en fazla etiket sayısı. */
export const MAX_RECORD_TAGS = 4

/** Bir hedefe (GESB / kendi ekran) aynı anda yüklenebilecek en fazla CANLI kaynak. */
export const MAX_SELECTABLE_VIDEOS = 4

/**
 * KAYITLI içerik yalnızca TEKLİ yüklenir — dörtlü yok. Kullanıcı geri
 * bildirimi: kayıtlı videoyu dörtlü göndermeye ihtiyaç duyulmuyor, hep tek
 * video izleniyor. Canlı kaynaklarda böyle bir kısıt YOK; 4 kamera/sensör
 * yan yana anlamlı olduğu için orada dörtlü serbest kalıyor.
 *
 * Seçim boşken (kind === null) henüz tür belli değil: üst sınır 4'tür, ilk
 * seçilen video kayıtlıysa sınır kendiliğinden 1'e iner.
 */
export function maxSelectableFor(kind: VcuVideoKind | null): number {
  return kind === "recorded" ? 1 : MAX_SELECTABLE_VIDEOS
}

/* ════════════════════════════════════════════════════════════════════
 *  TARİH FİLTRESİ
 * ════════════════════════════════════════════════════════════════════ */

export const DEFAULT_DATE_RANGE: VcuDateRange = {
  preset: "all",
  customStart: null,
  customEnd: null,
}

// Etiketler kısa tutuldu — büyütülmüş dokunma hedefleriyle 340px'lik
// sol panele 5 seçenek + "Tarih aralığı" başlığı birlikte sığsın diye.
const DATE_PRESETS: { value: VcuDatePreset; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "today", label: "Bugün" },
  { value: "week", label: "7 Gün" },
  { value: "month", label: "Ay" },
  { value: "custom", label: "Özel" },
]

/** Date -> "YYYY-MM-DD", yerel takvim gününe göre (UTC kaymasını önler). */
export function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * `videoDate` (video kaynağının "YYYY-MM-DD" tarihi) verilen aralığa uyuyor mu.
 * Canlı kameraların tarihi olmadığı için (`videoDate` undefined) her zaman true döner.
 */
export function matchesDateRange(
  videoDate: string | undefined,
  range: VcuDateRange,
  now: Date,
): boolean {
  if (!videoDate) return true
  if (range.preset === "all") return true

  const today = toIsoDate(now)

  if (range.preset === "today") return videoDate === today

  if (range.preset === "week") {
    const weekAgo = toIsoDate(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000))
    return videoDate >= weekAgo && videoDate <= today
  }

  if (range.preset === "month") {
    return videoDate.slice(0, 7) === today.slice(0, 7)
  }

  // custom
  if (range.customStart && videoDate < range.customStart) return false
  if (range.customEnd && videoDate > range.customEnd) return false
  return true
}

/** "04:12" / "1:02:03" → saniye. Boş/geçersizse 0. */
export function parseDuration(text: string | undefined): number {
  if (!text) return 0
  const parts = text.split(":").map((part) => Number.parseInt(part, 10))
  if (parts.some((part) => Number.isNaN(part))) return 0
  return parts.reduce((total, part) => total * 60 + part, 0)
}

/** Saniyeyi "mm:ss" (bir saati aşarsa "h:mm:ss") biçimine çevirir. */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  const mm = String(minutes).padStart(2, "0")
  const ss = String(seconds).padStart(2, "0")
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

/* ════════════════════════════════════════════════════════════════════
 *  TEMA
 * ════════════════════════════════════════════════════════════════════ */

export const VCU_DARK_THEME: ThemeConfig = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    colorPrimary: "#3b82f6",
    colorSuccess: "#10b981",
    colorWarning: "#f59e0b",
    colorError: "#e11d48",
    colorInfo: "#3b82f6",
    colorBgLayout: "#0c0d0e",
    colorBgContainer: "#141519",
    colorBgElevated: "#1c1d21",
    colorBorder: "#27282d",
    colorBorderSecondary: "#1f2024",
    colorText: "#f4f4f5",
    colorTextSecondary: "#a1a1aa",
    colorTextTertiary: "#71717a",
    borderRadius: 8,
    fontSize: 13,
    // Gerçek 10.1" dokunmatik tablette parmakla kullanılacak — antd'nin
    // varsayılan 32px kontrol yüksekliği fare için düşünülmüş, burada
    // ~44px dokunma hedefi hedefliyoruz (Apple/Google HIG önerisi).
    controlHeight: 40,
    controlHeightSM: 32,
    controlHeightLG: 48,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  components: {
    Card: { paddingLG: 12 },
    List: { paddingContentVertical: 10 },
    // Referans tasarımda aktif kategori/tarih pill'i mavi dolgu — Segmented'in
    // varsayılanı nötr gri olduğu için burada özellikle override ediyoruz.
    Segmented: {
      itemSelectedBg: "#2563eb",
      itemSelectedColor: "#ffffff",
    },
  },
}

/** Sol panel (video kütüphanesi), ana içerikten hafifçe ayrışan kendi tonu. */
export const VCU_SIDEBAR_BG: Record<VcuThemeMode, string> = {
  dark: "#0e0f12",
  light: "#f8fafc",
}

export const VCU_LIGHT_THEME: ThemeConfig = {
  algorithm: antdTheme.defaultAlgorithm,
  token: {
    ...VCU_DARK_THEME.token,
    colorSuccess: "#059669",
    colorWarning: "#d97706",
    colorBgLayout: "#ffffff",
    colorBgContainer: "#ffffff",
    colorBgElevated: "#ffffff",
    colorBorder: "#cbd5e1",
    colorBorderSecondary: "#e2e8f0",
    colorText: "#0f172a",
    colorTextSecondary: "#475569",
    colorTextTertiary: "#64748b",
  },
  components: VCU_DARK_THEME.components,
}

export const THEME_STORAGE_KEY = "vsu:vcu-mockup-theme"

export function readStoredTheme(): VcuThemeMode {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return stored === "light" ? "light" : "dark"
  } catch {
    return "dark"
  }
}

export function VcuLiveDotStyles() {
  return (
    <style>{`
      @keyframes vcu-gentle-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
      .vcu-live-dot { animation: vcu-gentle-pulse 2s infinite ease-in-out; }
    `}</style>
  )
}

/* ════════════════════════════════════════════════════════════════════
 *  ORTAK ÜST BAŞLIK — üç sayfa da bunu kullanır (sekmeler + tema + eylemler)
 * ════════════════════════════════════════════════════════════════════ */

/**
 * Tema seçici — alt çubukta durur, listesi YUKARI açılır (ekran dışına
 * taşmasın). Eskiden üst başlıkta bir düğmeydi; sekmelerin yanında konuyla
 * alakasız durduğu için buraya indirildi (bkz. VcuSelectionFooter).
 */
export function VcuThemeSelect({
  mode,
  onModeChange,
}: {
  mode: VcuThemeMode
  onModeChange: (mode: VcuThemeMode) => void
}) {
  return (
    <Select
      size="small"
      value={mode}
      onChange={(value) => onModeChange(value as VcuThemeMode)}
      placement="topRight"
      popupMatchSelectWidth={false}
      style={{ width: 108, flexShrink: 0 }}
      options={[
        {
          value: "dark" satisfies VcuThemeMode,
          label: (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11 }}>
              <MoonOutlined /> Koyu Mod
            </span>
          ),
        },
        {
          value: "light" satisfies VcuThemeMode,
          label: (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11 }}>
              <SunOutlined /> Açık Mod
            </span>
          ),
        },
      ]}
    />
  )
}

/**
 * Üst başlıktaki sayfa bağlantıları. Sekme değil BAĞLANTI: her sayfa kendi
 * adresinde ayrı bir pencere olduğu için hepsi yeni sekmede açılır.
 */
const PAGE_LINKS: { key: VcuPageKey; label: string; icon: ReactNode }[] = [
  { key: "gesb", label: "GESB Matrisi", icon: <AppstoreOutlined /> },
  { key: "adu", label: "ADU Ekranım", icon: <DesktopOutlined /> },
  { key: "record", label: "Video Kayıt", icon: <VideoCameraOutlined /> },
]

type VcuHeaderProps = {
  page: VcuPageKey
  /** Başlığın yanındaki gri açıklama — sayfaya göre değişir. */
  subtitle: string
  /** Sayfaya özgü eylemler (ör. "Tümünü Durdur"). */
  extra?: ReactNode
  /** Süren kayıt sayısı — "Video Kayıt" düğmesindeki rozet. */
  recordingCount?: number
  /**
   * Cihazın rolü. "Video Kayıt" düğmesi YALNIZCA operator'da (normal
   * bilgisayar) çıkar — 10.1" tablette kayıt alınmıyor.
   */
  role?: VcuRole
}

export function VcuHeader({
  page,
  subtitle,
  extra,
  recordingCount = 0,
  role = "operator",
}: VcuHeaderProps) {
  const { token } = useToken()

  return (
    <header
      style={{
        height: 56,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "0 16px",
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <div
          style={{
            width: 24,
            height: 24,
            flexShrink: 0,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: token.colorPrimaryBg,
            border: `1px solid ${token.colorPrimaryBorder}`,
            color: token.colorPrimary,
          }}
        >
          ▶
        </div>
        <Text strong style={{ fontSize: 12, flexShrink: 0 }}>
          Video Kontrol Ünitesi
        </Text>
        <Text type="secondary" style={{ fontSize: 11 }} ellipsis>
          {subtitle}
        </Text>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {/* SEKME ÇUBUĞU YOK. Üç sayfa da kendi adresinde ayrı birer pencere;
            buradaki bağlantılar hepsini YENİ SEKMEDE açar. Bulunulan sayfanın
            bağlantısı gösterilmez. Video kayıt yalnızca operatör
            bilgisayarında görünür — tablette kayıt alınmıyor. */}
        {PAGE_LINKS.map((link) => {
          if (link.key === page) return null
          if (link.key === "record" && role !== "operator") return null

          const button = (
            <Button
              icon={link.icon}
              href={vcuPageHref(link.key)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {link.label}
            </Button>
          )

          // Kayıt bağlantısında süren kayıt sayısı rozeti (0 ise antd gizler).
          return link.key === "record" ? (
            <Badge
              key={link.key}
              count={recordingCount}
              size="small"
              color={token.colorError}
              style={{ boxShadow: "none" }}
            >
              {button}
            </Badge>
          ) : (
            <span key={link.key} style={{ display: "inline-flex" }}>
              {button}
            </span>
          )
        })}

        {/* Tema düğmesi buradan alt çubuğa taşındı — bkz. VcuThemeSelect. */}

        {extra}
      </div>
    </header>
  )
}

/* ════════════════════════════════════════════════════════════════════
 *  VİDEO SATIRI (sol panel — kütüphane listesi)
 * ════════════════════════════════════════════════════════════════════ */

type VcuVideoRowProps = {
  video: VcuVideoSource
  selected: boolean
  /** Dörtlü modda seçim sırası (1-4). Tekli modda veya seçili değilken undefined. */
  slotNumber?: number
  /** Kayıtlı videolar kataloğundaki sırası (1, 2, 3...). Canlı kaynaklarda undefined. */
  orderNumber?: number
  /**
   * Mevcut seçim karşı türden olduğu için bu satır şu an seçilemez (bir karta
   * ya canlı ya kayıtlı yüklenebilir). Tıklama yine de açıklayıcı bir uyarı
   * göstersin diye devre dışı bırakılmıyor, sadece soluklaştırılıyor.
   */
  blocked?: boolean
  onToggle: () => void
}

function VcuVideoRow({
  video,
  selected,
  slotNumber,
  orderNumber,
  blocked,
  onToggle,
}: VcuVideoRowProps) {
  const { token } = useToken()
  const isLive = video.kind === "live"
  const sourceMeta = liveSourceMeta(video)
  const tags = video.tags ?? []

  return (
    <List.Item
      onClick={onToggle}
      style={{
        cursor: "pointer",
        opacity: blocked ? 0.4 : 1,
        padding: "10px 12px",
        borderRadius: token.borderRadius,
        marginBottom: 6,
        minHeight: 52,
        border: `1px solid ${selected ? token.colorPrimary : token.colorBorderSecondary}`,
        background: selected ? token.colorFillTertiary : token.colorBgContainer,
      }}
    >
      <List.Item.Meta
        avatar={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              borderRadius: 6,
              border: `1px solid ${token.colorBorderSecondary}`,
              color: isLive ? token.colorError : token.colorPrimary,
            }}
          >
            {isLive ? (sourceMeta?.icon ?? <VideoCameraOutlined />) : <PlaySquareOutlined />}
          </div>
        }
        title={
          orderNumber !== undefined ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              <Text style={{ fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                Opcon {orderNumber}
              </Text>
              <Tag
                title={video.name}
                style={{
                  marginInlineEnd: 0,
                  fontSize: 10,
                  lineHeight: "16px",
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {video.name}
              </Tag>
            </div>
          ) : (
            <Text style={{ fontSize: 12, fontWeight: 500 }} ellipsis>
              {video.name}
            </Text>
          )
        }
        description={
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 6,
                fontSize: 10,
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  minWidth: 0,
                  color: isLive ? token.colorError : token.colorTextTertiary,
                }}
              >
                {isLive ? "Canlı" : video.duration}
                {sourceMeta && (
                  <Tag
                    icon={sourceMeta.icon}
                    color={sourceMeta.color}
                    style={{
                      marginInlineEnd: 0,
                      fontSize: 10,
                      lineHeight: "16px",
                      paddingInline: 5,
                    }}
                  >
                    {sourceMeta.label}
                  </Tag>
                )}
              </span>
              {video.date && (
                <span style={{ fontFamily: "monospace", color: token.colorTextTertiary }}>
                  {video.date}
                </span>
              )}
            </div>

            {tags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                {tags.map((tag) => (
                  <Tag
                    key={tag}
                    bordered={false}
                    color="blue"
                    style={{
                      marginInlineEnd: 0,
                      fontSize: 9,
                      lineHeight: "15px",
                      paddingInline: 5,
                    }}
                  >
                    {tag}
                  </Tag>
                ))}
              </div>
            )}
          </div>
        }
      />

      {selected ? (
        <Tag color="blue" style={{ marginInlineEnd: 0 }}>
          {slotNumber ?? <CheckOutlined />}
        </Tag>
      ) : (
        <Text type="secondary" style={{ fontWeight: 700 }}>
          +
        </Text>
      )}
    </List.Item>
  )
}

/* ════════════════════════════════════════════════════════════════════
 *  VİDEO KÜTÜPHANESİ (sol panel) — GESB ve ADU sayfaları paylaşır
 * ════════════════════════════════════════════════════════════════════ */

type VcuVideoLibraryProps = {
  mode: VcuThemeMode
  videos: VcuVideoSource[]
  selectedVideoIds: string[]
  /**
   * Seçimin türü — bir hedefe ya canlı ya kayıtlı yüklenebilir. Doluysa karşı
   * türdeki satırlar soluk gösterilir (tıklanınca sayfa uyarı verir).
   */
  selectionKind: VcuVideoKind | null
  layout: VcuLayout
  footerHint: string
  onToggleVideo: (id: string) => void
}

export function VcuVideoLibrary({
  mode,
  videos,
  selectedVideoIds,
  selectionKind,
  layout,
  footerHint,
  onToggleVideo,
}: VcuVideoLibraryProps) {
  const { token } = useToken()
  const [search, setSearch] = useState("")
  const [kindFilter, setKindFilter] = useState<VcuVideoKind | "all">("all")
  /** Sadece "Canlı" sekmesinde geçerli — kamera/sensör/radar arasında daraltır. */
  const [liveTypeFilter, setLiveTypeFilter] = useState<VcuLiveSourceType | "all">("all")
  /** Sadece "Kayıtlı" sekmesinde geçerli — seçilen etiketlerden HERHANGİ birini taşıyanlar. */
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const [dateRange, setDateRange] = useState(DEFAULT_DATE_RANGE)

  const recordedCount = videos.filter((v) => v.kind === "recorded").length
  const liveVideoCount = videos.filter((v) => v.kind === "live").length

  /** Kayıtlı videolarda geçen tüm etiketler — filtre kutusunun seçenekleri. */
  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const video of videos) {
      for (const tag of video.tags ?? []) set.add(tag)
    }
    return [...set].sort((a, b) => a.localeCompare(b, "tr-TR"))
  }, [videos])

  /** Kayıtlı videoları katalog sırasına göre numaralandırır (1, 2, 3...); canlı kaynaklarda karşılık yok. */
  const recordedIndexById = useMemo(() => {
    const map = new Map<string, number>()
    let count = 0
    for (const video of videos) {
      if (video.kind === "recorded") {
        count += 1
        map.set(video.id, count)
      }
    }
    return map
  }, [videos])

  const filteredVideos = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("tr-TR")
    const now = new Date()
    return videos.filter((video) => {
      if (kindFilter !== "all" && video.kind !== kindFilter) return false

      // Tür filtresi yalnızca "Canlı" sekmesinde görünür, orada da yalnızca
      // canlı kaynaklara uygulanır (kayıtlı videonun donanım türü yok).
      if (kindFilter === "live" && liveTypeFilter !== "all" && video.sourceType !== liveTypeFilter) {
        return false
      }

      // Etiket filtresi yalnızca "Kayıtlı" sekmesinde; seçilenlerden en az biri.
      if (kindFilter === "recorded" && tagFilter.length > 0) {
        const tags = video.tags ?? []
        if (!tagFilter.some((tag) => tags.includes(tag))) return false
      }

      // Arama hem ada hem etiketlere bakar — "tatbikat" yazınca o etiketli
      // kayıtlar da gelsin diye.
      if (query) {
        const haystack = [video.name, ...(video.tags ?? [])]
          .join(" ")
          .toLocaleLowerCase("tr-TR")
        if (!haystack.includes(query)) return false
      }

      if (!matchesDateRange(video.date, dateRange, now)) return false
      return true
    })
  }, [videos, search, kindFilter, liveTypeFilter, tagFilter, dateRange])

  return (
    <section
      style={{
        width: 340,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRight: `1px solid ${token.colorBorderSecondary}`,
        background: VCU_SIDEBAR_BG[mode],
      }}
    >
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: 10,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Kayıtlı veya canlı video ara..."
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
          allowClear
        />

        <Segmented
          block
          value={kindFilter}
          onChange={(value) => setKindFilter(value as VcuVideoKind | "all")}
          options={[
            { label: `Tümü (${videos.length})`, value: "all" },
            { label: `Kayıtlı (${recordedCount})`, value: "recorded" },
            { label: `Canlı (${liveVideoCount})`, value: "live" },
          ]}
        />

        {/* Canlı sekmesi: kaynak türü (kamera / sensör / radar) */}
        {kindFilter === "live" && (
          <Segmented
            block
            value={liveTypeFilter}
            onChange={(value) => setLiveTypeFilter(value as VcuLiveSourceType | "all")}
            options={[
              { label: "Tümü", value: "all" },
              ...LIVE_SOURCE_ORDER.map((type) => ({
                label: LIVE_SOURCE_META[type].label,
                value: type,
              })),
            ]}
          />
        )}

        {/* Kayıtlı sekmesi: etikete göre daraltma */}
        {kindFilter === "recorded" && (
          <Select
            mode="multiple"
            allowClear
            value={tagFilter}
            onChange={setTagFilter}
            placeholder="Etikete göre filtrele"
            suffixIcon={<TagsOutlined />}
            style={{ width: "100%" }}
            maxTagCount="responsive"
            options={allTags.map((tag) => ({ label: tag, value: tag }))}
            notFoundContent="Etiket yok"
          />
        )}

        <div
          style={{
            paddingTop: 6,
            borderTop: `1px solid ${token.colorBorderSecondary}`,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <Text type="secondary" style={{ fontSize: 11, fontWeight: 500 }}>
            Tarih aralığı
          </Text>

          <Segmented
            block
            value={dateRange.preset}
            onChange={(value) =>
              setDateRange((prev) => ({ ...prev, preset: value as VcuDatePreset }))
            }
            options={DATE_PRESETS.map((preset) => ({
              label: preset.label,
              value: preset.value,
            }))}
          />

          {dateRange.preset === "custom" && (
            <RangePicker
              style={{ width: "100%" }}
              value={[
                dateRange.customStart ? dayjs(dateRange.customStart) : null,
                dateRange.customEnd ? dayjs(dateRange.customEnd) : null,
              ]}
              onChange={(values) =>
                setDateRange((prev) => ({
                  ...prev,
                  customStart: values?.[0] ? values[0].format("YYYY-MM-DD") : null,
                  customEnd: values?.[1] ? values[1].format("YYYY-MM-DD") : null,
                }))
              }
            />
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
        <List
          dataSource={filteredVideos}
          locale={{ emptyText: "Kayıt bulunamadı." }}
          renderItem={(video) => {
            const selectedIndex = selectedVideoIds.indexOf(video.id)
            return (
              <VcuVideoRow
                key={video.id}
                video={video}
                selected={selectedIndex !== -1}
                slotNumber={layout === "quad" && selectedIndex !== -1 ? selectedIndex + 1 : undefined}
                orderNumber={recordedIndexById.get(video.id)}
                blocked={selectionKind !== null && video.kind !== selectionKind}
                onToggle={() => onToggleVideo(video.id)}
              />
            )
          }}
        />
      </div>

      <div
        style={{
          flexShrink: 0,
          padding: "6px 8px",
          textAlign: "center",
          fontSize: 10,
          color: token.colorTextTertiary,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        {footerHint}
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════
 *  SLOT ÖNİZLEME — GESB kartı ve "Bu Ekran" (ADU) kartı bunu paylaşır
 * ════════════════════════════════════════════════════════════════════ */

export function slotVideo(
  id: string | null,
  videosById: Map<string, VcuVideoSource>,
): VcuVideoSource | null {
  if (!id) return null
  return videosById.get(id) ?? null
}

/**
 * Bir hedefin (GESB / kendi ekran) taşıdığı içeriğin türü. Karışık yükleme
 * engellendiği için ilk dolu slot tüm kartı temsil eder; kart boşsa null.
 */
export function slotsKind(
  slots: (string | null)[],
  videosById: Map<string, VcuVideoSource>,
): VcuVideoKind | null {
  for (const id of slots) {
    const video = slotVideo(id, videosById)
    if (video) return video.kind
  }
  return null
}

/** Kartın üst köşesindeki "Canlı" / "Kayıtlı" içerik rozeti (boş kartta yok). */
export function VcuKindTag({ kind }: { kind: VcuVideoKind | null }) {
  if (!kind) return null
  return (
    <Tag
      color={kind === "live" ? "red" : "blue"}
      icon={kind === "live" ? <VideoCameraOutlined /> : <PlaySquareOutlined />}
      style={{ marginInlineEnd: 0 }}
    >
      {kind === "live" ? "Canlı" : "Kayıtlı"}
    </Tag>
  )
}

type VcuSlotsPreviewProps = {
  slots: (string | null)[]
  videosById: Map<string, VcuVideoSource>
  /** Boşken vurgulanmalı mı (GESB'de "hedef seçili" demek; ADU'da hep false). */
  emptyActive: boolean
  emptyHint: string
  /** Yayındayken bölme kaldırmayı kilitler (bkz. sayfa düzeyi kısıt). */
  removeDisabled: boolean
  onRemoveSlot: (index: number) => void
  /**
   * true ise dış kapsayıcının verdiği tüm yüksekliği doldurur (ADU'nun tek
   * "Bu Ekran" kartı) — false ise GESB grid kartlarındaki sabit 108px önizleme.
   */
  fill?: boolean
  /**
   * Dörtlü düzende hangi bölmenin transport çubuğuyla kontrol edildiği.
   * Verilmezse (tekli mod ya da çağıran ilgilenmiyorsa) seçim vurgusu/tıklama
   * yok — sadece kaldırma ("×") çalışır.
   */
  activeSlotIndex?: number | null
  onSelectSlot?: (index: number) => void
}

export function VcuSlotsPreview({
  slots,
  videosById,
  emptyActive,
  emptyHint,
  removeDisabled,
  onRemoveSlot,
  fill,
  activeSlotIndex = null,
  onSelectSlot,
}: VcuSlotsPreviewProps) {
  const { token } = useToken()
  const filledCount = slots.filter(Boolean).length
  // height:"100%" bir flex-column içindeki flex item'da güvenilir çözülmüyor;
  // gerçekten kalan alanı doldurmak için flex-grow kullanıyoruz (bkz. fill notu).
  const boxSize: CSSProperties = fill ? { flex: 1, minHeight: 0 } : { height: 108 }

  return (
    <div
      style={
        fill
          ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }
          : { minHeight: 108, display: "flex", flexDirection: "column", justifyContent: "center" }
      }
    >
      {filledCount === 0 && (
        <div
          style={{
            ...boxSize,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            borderRadius: token.borderRadius,
            border: `2px dashed ${emptyActive ? token.colorPrimary : token.colorBorderSecondary}`,
            background: emptyActive ? token.colorPrimaryBg : token.colorFillTertiary,
          }}
        >
          <PlusOutlined style={{ color: token.colorTextTertiary }} />
          <Text type="secondary" style={{ fontSize: 11, textAlign: "center", padding: "0 8px" }}>
            {emptyHint}
          </Text>
        </div>
      )}

      {filledCount === 1 &&
        (() => {
          const video = slotVideo(slots[0] ?? null, videosById)
          if (!video) return null
          const isLiveVideo = video.kind === "live"
          const meta = liveSourceMeta(video)
          return (
            <div
              style={{
                ...boxSize,
                display: "flex",
                flexDirection: "column",
                // fill modunda space-between, ortadaki başlığı kutunun tam
                // dikey merkezine iterdi (kutu artık kocaman) — içerik yerine
                // hep en üstte kümelensin diye flex-start + gap kullanıyoruz.
                justifyContent: fill ? "flex-start" : "space-between",
                gap: fill ? 6 : undefined,
                borderRadius: token.borderRadius,
                border: `1px solid ${token.colorBorderSecondary}`,
                background: token.colorBgContainer,
                padding: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                    color: isLiveVideo ? token.colorError : token.colorPrimary,
                  }}
                >
                  {isLiveVideo
                    ? `● Canlı Akış${meta ? ` · ${meta.label}` : ""}`
                    : "Kayıtlı · Tekli (1x1)"}
                </Text>
                <Button
                  type="text"
                  disabled={removeDisabled}
                  icon={<CloseOutlined style={{ fontSize: 13 }} />}
                  onClick={(event) => {
                    event.stopPropagation()
                    onRemoveSlot(0)
                  }}
                />
              </div>
              <Text ellipsis style={{ fontSize: 12, fontWeight: 500 }}>
                {video.name}
              </Text>
              <Text type="secondary" style={{ fontSize: 10 }}>
                {video.duration ? `Süre: ${video.duration}` : "Gerçek zamanlı"}
              </Text>
            </div>
          )
        })()}

      {filledCount > 1 && (
        <div
          style={{
            ...boxSize,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gridTemplateRows: fill ? "1fr 1fr" : undefined,
            gap: 8,
          }}
        >
          {slots.map((slotId, index) => {
            const video = slotVideo(slotId, videosById)
            if (!video) {
              return (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: token.borderRadiusSM,
                    border: `1px dashed ${token.colorBorderSecondary}`,
                    background: token.colorFillTertiary,
                    fontSize: 10,
                    color: token.colorTextTertiary,
                  }}
                >
                  Boş
                </div>
              )
            }
            const isActive = onSelectSlot !== undefined && activeSlotIndex === index
            return (
              <div
                key={video.id}
                onClick={
                  onSelectSlot &&
                    ((event: ReactMouseEvent) => {
                      // Bölme seçimi, kartın kendisini hedeflemesini (GESB
                      // seçme) tetiklemesin diye burada duruyor.
                      event.stopPropagation()
                      onSelectSlot(index)
                    })
                }
                style={{
                  display: "flex",
                  // Hücre (grid item) fill modunda tam yüksekliğe geriliyor;
                  // alignItems:"center" etiketi/çarpıyı hücrenin dikey ortasına
                  // düşürüyordu — sabit üstte kalması için flex-start.
                  alignItems: fill ? "flex-start" : "center",
                  justifyContent: "space-between",
                  gap: 4,
                  cursor: onSelectSlot ? "pointer" : undefined,
                  borderRadius: token.borderRadiusSM,
                  border: `1px solid ${isActive ? token.colorPrimary : token.colorBorderSecondary}`,
                  background: isActive ? token.colorPrimaryBg : token.colorBgContainer,
                  padding: fill ? "8px 10px" : "4px 6px",
                  minWidth: 0,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{ fontFamily: "monospace", fontSize: 8, color: token.colorTextTertiary }}
                  >
                    #{index + 1}{" "}
                    {video.kind === "live" ? (liveSourceMeta(video)?.short ?? "CANLI") : "KAYITLI"}
                    {isActive && " · KONTROL"}
                  </div>
                  <Text ellipsis style={{ fontSize: 11, lineHeight: 1.2, fontWeight: 500 }}>
                    {video.name}
                  </Text>
                </div>
                <Button
                  type="text"
                  disabled={removeDisabled}
                  icon={<CloseOutlined style={{ fontSize: 12 }} />}
                  onClick={(event) => {
                    event.stopPropagation()
                    onRemoveSlot(index)
                  }}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
 *  TRANSPORT ÇUBUĞU — kayıtlı içerikte sarma / hız kontrolü
 *
 *  Yalnızca KAYITLI içerik yüklüyken görünür; canlı kaynakta sarma yok.
 *  "Ya canlı ya kayıtlı" kısıtı tam da bunu mümkün kılıyor — karışık bir
 *  kartta "hangisini sarıyorum" sorusu hiç doğmuyor.
 *
 *  BİLEREK OYNAT/DURAKLAT DÜĞMESİ YOK: tek "oynat/durdur" anahtarı kartın alt
 *  satırındaki Yayınla/Durdur'dur. Burada ikinci bir toggle olsaydı ikisi
 *  aynı işi yapıyormuş gibi görünüp kafa karıştırırdı. Çubuk yalnızca konum +
 *  hız + ±sarma sunar; "oynuyor mu" hep hedefin `status === "live"` olmasından
 *  gelir (bkz. VcuTransport tipi).
 *
 *  İSTEK MODELİ (mockup'ta simüle, gerçek entegrasyonda aynen geçerli):
 *  sürekli döngü yok, YERLEŞMİŞ her etkileşim TEK istek. Slider sürüklenirken
 *  hiçbir şey gönderilmez (dragValue yerel tutulur), parmak kalkınca
 *  onChangeComplete bir kez ateşlenir. ±10sn ve hız değişimi de birer istek.
 * ════════════════════════════════════════════════════════════════════ */

type VcuTransportBarProps = {
  transport: VcuTransport
  /** Bu bölmedeki videonun uzunluğu (saniye). 0 ise çubuk kilitli görünür. */
  duration: number
  /**
   * Hedef yayında mı. false → yerel önizleme (hiçbir şey hedefe gitmez).
   * true → canlı kontrol, her etkileşim hedef ekrana anlık istek olur.
   */
  live: boolean
  /** Dörtlü düzende hangi bölmenin kontrol edildiği (ör. "#2 · Opcon 3"). Tekli modda yok. */
  activeLabel?: string
  onChange: (next: Partial<VcuTransport>) => void
}

export function VcuTransportBar({
  transport,
  duration,
  live,
  activeLabel,
  onChange,
}: VcuTransportBarProps) {
  const { token } = useToken()
  /** Sürükleme sırasındaki geçici konum — commit edilene kadar istek yok. */
  const [dragValue, setDragValue] = useState<number | null>(null)

  const position = dragValue ?? transport.position
  const disabled = duration === 0

  function seekBy(delta: number) {
    const next = Math.min(duration, Math.max(0, transport.position + delta))
    onChange({ position: next })
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        marginTop: 10,
        padding: "8px 10px",
        borderRadius: token.borderRadius,
        border: `1px solid ${live ? token.colorErrorBorder : token.colorBorderSecondary}`,
        background: live ? token.colorErrorBg : token.colorFillQuaternary,
      }}
      // Kart tıklaması (GESB hedefleme) transport kullanırken tetiklenmesin.
      onClick={(event) => event.stopPropagation()}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <Tag
            color={live ? "error" : "default"}
            style={{ marginInlineEnd: 0, fontSize: 9, lineHeight: "16px" }}
          >
            {live ? "● Canlı kontrol" : "Yerel önizleme"}
          </Tag>
          {activeLabel && (
            <Text type="secondary" style={{ fontSize: 10 }} ellipsis>
              Kontrol: {activeLabel}
            </Text>
          )}
        </div>
        <Text style={{ fontFamily: "monospace", fontSize: 11, flexShrink: 0 }}>
          {formatDuration(position)} / {formatDuration(duration)}
        </Text>
      </div>

      <Slider
        min={0}
        max={duration || 1}
        value={position}
        disabled={disabled}
        tooltip={{ formatter: (value) => formatDuration(value ?? 0) }}
        // Sürüklerken YEREL: tek bir istek bile gitmez.
        onChange={setDragValue}
        // Parmak kalkınca TEK commit — gerçek entegrasyonda tek POST.
        onChangeComplete={(value) => {
          setDragValue(null)
          onChange({ position: value })
        }}
        style={{ margin: "2px 4px" }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Button
            size="small"
            disabled={disabled}
            icon={<FastBackwardOutlined />}
            onClick={() => seekBy(-TRANSPORT_STEP_SECONDS)}
          >
            {TRANSPORT_STEP_SECONDS}sn
          </Button>

          <Button
            size="small"
            disabled={disabled}
            icon={<FastForwardOutlined />}
            onClick={() => seekBy(TRANSPORT_STEP_SECONDS)}
          >
            {TRANSPORT_STEP_SECONDS}sn
          </Button>
        </div>

        <Segmented
          size="small"
          value={transport.rate}
          disabled={disabled}
          onChange={(value) => onChange({ rate: Number(value) })}
          options={TRANSPORT_RATES.map((rate) => ({ label: `${rate}x`, value: rate }))}
        />
      </div>

      {!live && (
        <Text type="secondary" style={{ fontSize: 10 }}>
          Yayına hazır: {formatDuration(transport.position)}
          {transport.rate !== 1 && ` · ${transport.rate}x`} — "Yayınla" deyince bu konumdan başlar.
        </Text>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
 *  ALT ÇUBUK — GESB ve ADU sayfalarının ortak seçim özeti
 * ════════════════════════════════════════════════════════════════════ */

type VcuSelectionFooterProps = {
  selectedVideoIds: string[]
  videosById: Map<string, VcuVideoSource>
  selectionKind: VcuVideoKind | null
  layout: VcuLayout
  /** Sağdaki durum metni — sayfaya göre değişir. */
  statusText: string
  onRemoveSelected: (id: string) => void
  mode: VcuThemeMode
  onModeChange: (mode: VcuThemeMode) => void
}

export function VcuSelectionFooter({
  selectedVideoIds,
  videosById,
  selectionKind,
  layout,
  statusText,
  onRemoveSelected,
  mode,
  onModeChange,
}: VcuSelectionFooterProps) {
  const { token } = useToken()

  return (
    <footer
      style={{
        height: 40,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 12px",
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
        <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>
          {/* Üst sınır türe bağlı: kayıtlıda 1, canlıda 4 (bkz. maxSelectableFor). */}
          Seçili: {selectedVideoIds.length}/{maxSelectableFor(selectionKind)}
        </Text>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {selectedVideoIds.map((id) => (
            <Tag
              key={id}
              closable
              onClose={(event) => {
                event.preventDefault()
                onRemoveSelected(id)
              }}
              style={{ marginInlineEnd: 0, fontSize: 10 }}
            >
              {videosById.get(id)?.name}
            </Tag>
          ))}
        </div>
      </div>

      <div style={{ width: 1, height: 20, background: token.colorBorderSecondary }} />

      <Tooltip
        title={
          selectionKind === "recorded"
            ? "Kayıtlı video yalnızca tekli yüklenir — dörtlü yok."
            : "Bir hedefe ya canlı ya kayıtlı içerik yüklenebilir — ikisi aynı kartta olamaz. Dörtlü yalnızca canlı kaynaklarda."
        }
      >
        <span>
          <VcuKindTag kind={selectionKind} />
        </span>
      </Tooltip>

      <Tag color={layout === "quad" ? "warning" : "blue"} style={{ marginInlineEnd: 0 }}>
        {layout === "quad" ? "Dörtlü" : "Tekli"}
      </Tag>

      <div style={{ width: 1, height: 20, background: token.colorBorderSecondary }} />

      <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>
        {statusText}
      </Text>

      <div style={{ width: 1, height: 20, background: token.colorBorderSecondary }} />

      <VcuThemeSelect mode={mode} onModeChange={onModeChange} />
    </footer>
  )
}
