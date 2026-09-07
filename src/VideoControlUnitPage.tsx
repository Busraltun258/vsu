
/**
 * ════════════════════════════════════════════════════════════════════
 *  VIDEO KONTROL ÜNİTESİ (VCU) — TASARIM MOCKUP'I
 *
 *  10.1" dokunmatik tablet üzerinden GESB'lere (büyük ekranlara) video
 *  dağıtımı yapan kiosk arayüzü. Ant Design ile kurulu, projenin geri
 *  kalanından (uygulamanın kendi @rei/shared temasından) tamamen
 *  bağımsız — <ConfigProvider> bu dosyaya scoped, global temayı
 *  etkilemiyor.
 *
 *  Tek dosyada toplandı: tüm tipler, sahte veri, tarih filtresi, tema
 *  ve bileşenler burada — antd/@ant-design/icons/dayjs dışında hiçbir
 *  iç referansı yok. Gerçek control-screen akışını (ControlScreen.tsx)
 *  DEĞİŞTİRMEZ, /mockup rotasında ayrı bir sayfa olarak durur.
 *
 *  Backend'e bağlı değil — gerçek bir video matrix/switcher entegrasyonu
 *  geldiğinde "SAHTE VERİ" bölümünün yerini bir API client'ı alır.
 * ════════════════════════════════════════════════════════════════════ */

import {
    CheckOutlined,
    CloseOutlined,
    MoonOutlined,
    PauseOutlined,
    PlayCircleFilled,
    PlaySquareOutlined,
    PlusOutlined,
    PoweroffOutlined,
    SearchOutlined,
    SunOutlined,
    VideoCameraOutlined,
    WifiOutlined,
} from "@ant-design/icons"
import {
    App as AntApp,
    Badge,
    Button,
    Card,
    ConfigProvider,
    DatePicker,
    Input,
    List,
    Popconfirm,
    Segmented,
    Tag,
    Typography,
    theme as antdTheme,
    type ThemeConfig,
} from "antd"
import dayjs from "dayjs"
import { useEffect, useMemo, useState } from "react"

const { useToken } = antdTheme
const { Text } = Typography
const { RangePicker } = DatePicker

/* ════════════════════════════════════════════════════════════════════
 *  TİPLER
 * ════════════════════════════════════════════════════════════════════ */

type VcuVideoKind = "recorded" | "live"

type VcuVideoSource = {
  id: string
  name: string
  kind: VcuVideoKind
  /** Sadece kayıtlı videolarda anlamlı. */
  duration?: string
  /** ISO tarih (YYYY-MM-DD). Sadece kayıtlı videolarda var — canlı kameraların "tarihi" olmaz. */
  date?: string
}

type VcuGesbStatus = "offline" | "idle" | "loaded" | "live"
type VcuLayout = "single" | "quad"

type VcuGesb = {
  id: string
  name: string
  location: string
  status: VcuGesbStatus
  layout: VcuLayout
  /** 4 slot — single modda sadece slots[0] anlamlı. */
  slots: (string | null)[]
}

type VcuDatePreset = "all" | "today" | "week" | "month" | "custom"

type VcuDateRange = {
  preset: VcuDatePreset
  customStart: string | null
  customEnd: string | null
}

type VcuThemeMode = "dark" | "light"

/* ════════════════════════════════════════════════════════════════════
 *  SAHTE VERİ
 * ════════════════════════════════════════════════════════════════════ */

const initialVideos: VcuVideoSource[] = [
  { id: "v1", name: "Açılış Konuşması", kind: "recorded", duration: "04:12", date: "2026-09-06" },
  { id: "v2", name: "Sponsor Tanıtım Filmi", kind: "recorded", duration: "01:45", date: "2026-09-02" },
  { id: "v3", name: "Ürün Lansmanı", kind: "recorded", duration: "06:30", date: "2026-09-05" },
  { id: "v4", name: "Sahne Kamerası 1", kind: "live" },
  { id: "v5", name: "Sahne Kamerası 2", kind: "live" },
  { id: "v6", name: "Salon Genel Kamera", kind: "live" },
  { id: "v7", name: "Kapanış Filmi", kind: "recorded", duration: "03:05", date: "2026-09-01" },
  { id: "v8", name: "Röportaj - CEO", kind: "recorded", duration: "08:20", date: "2026-08-15" },
  { id: "v9", name: "Fuaye Kamerası", kind: "live" },
  {
    id: "v10",
    name: "Katılımcı Anket Sonuçları",
    kind: "recorded",
    duration: "02:15",
    date: "2026-09-03",
  },
  {
    id: "v11",
    name: "Sahne Arkası Görüntüleri",
    kind: "recorded",
    duration: "05:50",
    date: "2026-07-20",
  },
  { id: "v12", name: "Giriş Kamerası", kind: "live" },
]

const initialGesbs: VcuGesb[] = [
  {
    id: "g1",
    name: "GESB 1",
    location: "Ana Sahne Arkası",
    status: "live",
    layout: "single",
    slots: ["v4", null, null, null],
  },
  {
    id: "g2",
    name: "GESB 2",
    location: "Sol Fuaye",
    status: "loaded",
    layout: "quad",
    slots: ["v1", "v9", "v6", null],
  },
  {
    id: "g3",
    name: "GESB 3",
    location: "Sağ Fuaye",
    status: "idle",
    layout: "single",
    slots: [null, null, null, null],
  },
  {
    id: "g4",
    name: "GESB 4",
    location: "VIP Lounge",
    status: "offline",
    layout: "single",
    slots: [null, null, null, null],
  },
  {
    id: "g5",
    name: "GESB 5",
    location: "Basın Odası",
    status: "idle",
    layout: "single",
    slots: [null, null, null, null],
  },
  {
    id: "g6",
    name: "GESB 6",
    location: "Giriş Holü",
    status: "idle",
    layout: "single",
    slots: [null, null, null, null],
  },
]

/* ════════════════════════════════════════════════════════════════════
 *  TARİH FİLTRESİ
 * ════════════════════════════════════════════════════════════════════ */

const DEFAULT_DATE_RANGE: VcuDateRange = {
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
function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * `videoDate` (video kaynağının "YYYY-MM-DD" tarihi) verilen aralığa uyuyor mu.
 * Canlı kameraların tarihi olmadığı için (`videoDate` undefined) her zaman true döner.
 */
function matchesDateRange(videoDate: string | undefined, range: VcuDateRange, now: Date): boolean {
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

/* ════════════════════════════════════════════════════════════════════
 *  TEMA
 * ════════════════════════════════════════════════════════════════════ */

const VCU_DARK_THEME: ThemeConfig = {
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
const VCU_SIDEBAR_BG: Record<VcuThemeMode, string> = {
  dark: "#0e0f12",
  light: "#f8fafc",
}

const VCU_LIGHT_THEME: ThemeConfig = {
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

const THEME_STORAGE_KEY = "vsu:vcu-mockup-theme"

function readStoredTheme(): VcuThemeMode {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return stored === "light" ? "light" : "dark"
  } catch {
    return "dark"
  }
}

function VcuLiveDotStyles() {
  return (
    <style>{`
      @keyframes vcu-gentle-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
      .vcu-live-dot { animation: vcu-gentle-pulse 2s infinite ease-in-out; }
    `}</style>
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
  onToggle: () => void
}

function VcuVideoRow({ video, selected, slotNumber, onToggle }: VcuVideoRowProps) {
  const { token } = useToken()
  const isLive = video.kind === "live"

  return (
    <List.Item
      onClick={onToggle}
      style={{
        cursor: "pointer",
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
            {isLive ? <VideoCameraOutlined /> : <PlaySquareOutlined />}
          </div>
        }
        title={
          <Text style={{ fontSize: 12, fontWeight: 500 }} ellipsis>
            {video.name}
          </Text>
        }
        description={
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
            <span style={{ color: isLive ? token.colorError : token.colorTextTertiary }}>
              {isLive ? "Canlı" : video.duration}
            </span>
            {video.date && (
              <span style={{ fontFamily: "monospace", color: token.colorTextTertiary }}>
                {video.date}
              </span>
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
 *  GESB KARTI (sağ panel — hedef ekranlar)
 * ════════════════════════════════════════════════════════════════════ */

type VcuGesbCardProps = {
  gesb: VcuGesb
  videosById: Map<string, VcuVideoSource>
  /** Bir sonraki video seçiminin hedefi olarak seçili mi. */
  selected: boolean
  onToggleSelect: () => void
  onStart: () => void
  onStop: () => void
  onClear: () => void
  onRemoveSlot: (index: number) => void
}

function slotVideo(
  id: string | null,
  videosById: Map<string, VcuVideoSource>,
): VcuVideoSource | null {
  if (!id) return null
  return videosById.get(id) ?? null
}

function VcuGesbCard({
  gesb,
  videosById,
  selected,
  onToggleSelect,
  onStart,
  onStop,
  onClear,
  onRemoveSlot,
}: VcuGesbCardProps) {
  const { token } = useToken()
  const isOffline = gesb.status === "offline"
  const isLive = gesb.status === "live"
  const isLoaded = gesb.status === "loaded"
  const hasContent = isLive || isLoaded
  const filledCount = gesb.slots.filter(Boolean).length

  const dotColor = isLive
    ? token.colorError
    : hasContent
      ? token.colorWarning
      : token.colorTextQuaternary

  const modeTag = isOffline ? (
    <Tag icon={<WifiOutlined />} color="default">
      Bağlı değil
    </Tag>
  ) : filledCount === 0 ? (
    <Tag color="default">Boş</Tag>
  ) : filledCount === 1 ? (
    <Tag color="blue">Tekli (1x1)</Tag>
  ) : (
    <Tag color="warning">Dörtlü ({filledCount}/4)</Tag>
  )

  return (
    <Card
      hoverable={!isOffline}
      onClick={() => !isOffline && onToggleSelect()}
      size="small"
      style={{
        opacity: isOffline ? 0.6 : 1,
        cursor: isOffline ? "not-allowed" : "pointer",
        borderColor: selected ? token.colorPrimary : undefined,
        background: selected ? token.colorPrimaryBg : undefined,
      }}
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
          <span
            className={isLive ? "vcu-live-dot" : undefined}
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: dotColor,
              display: "inline-block",
            }}
          />
          {gesb.name}
          <Text type="secondary" style={{ fontWeight: 400, fontSize: 11 }}>
            ({gesb.location})
          </Text>
        </div>
      }
      extra={modeTag}
    >
      {/* Adaptif içerik alanı */}
      <div style={{ minHeight: 108, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {filledCount === 0 && (
          <div
            style={{
              height: 108,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              borderRadius: token.borderRadius,
              border: `2px dashed ${selected ? token.colorPrimary : token.colorBorderSecondary}`,
              background: selected ? token.colorPrimaryBg : token.colorFillTertiary,
            }}
          >
            <PlusOutlined style={{ color: token.colorTextTertiary }} />
            <Text type="secondary" style={{ fontSize: 11, textAlign: "center", padding: "0 8px" }}>
              {selected ? "Video seçin, buraya yüklenecek" : "Hedeflemek için dokunun"}
            </Text>
          </div>
        )}

        {filledCount === 1 &&
          (() => {
            const video = slotVideo(gesb.slots[0] ?? null, videosById)
            if (!video) return null
            const isLiveVideo = video.kind === "live"
            return (
              <div
                style={{
                  height: 108,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
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
                    {isLiveVideo ? "● Canlı Akış" : "Kayıtlı · Tekli (1x1)"}
                  </Text>
                  <Button
                    type="text"
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
          <div style={{ height: 108, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {gesb.slots.map((slotId, index) => {
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
              return (
                <div
                  key={video.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 4,
                    borderRadius: token.borderRadiusSM,
                    border: `1px solid ${token.colorBorderSecondary}`,
                    background: token.colorBgContainer,
                    padding: "4px 6px",
                    minWidth: 0,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontFamily: "monospace", fontSize: 8, color: token.colorTextTertiary }}>
                      #{index + 1} {video.kind === "live" ? "CANLI" : "KAYITLI"}
                    </div>
                    <Text ellipsis style={{ fontSize: 11, lineHeight: 1.2, fontWeight: 500 }}>
                      {video.name}
                    </Text>
                  </div>
                  <Button
                    type="text"
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

      {/* Alt buton çubuğu — Başlat, Durdur, Temizle */}
      {!isOffline && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 10,
            paddingTop: 8,
            borderTop: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              disabled={filledCount === 0}
              icon={<PlayCircleFilled />}
              style={
                isLive
                  ? { color: token.colorSuccess, borderColor: token.colorSuccess }
                  : { background: token.colorSuccess, borderColor: token.colorSuccess, color: "#fff" }
              }
              onClick={(event) => {
                event.stopPropagation()
                if (!isLive) onStart()
              }}
            >
              {isLive ? "Yayında" : "Başlat"}
            </Button>

            <Button
              disabled={!isLive}
              icon={<PauseOutlined />}
              onClick={(event) => {
                event.stopPropagation()
                onStop()
              }}
            >
              Durdur
            </Button>
          </div>

          <Button
            type="text"
            disabled={filledCount === 0}
            onClick={(event) => {
              event.stopPropagation()
              onClear()
            }}
          >
            Temizle
          </Button>
        </div>
      )}
    </Card>
  )
}

/* ════════════════════════════════════════════════════════════════════
 *  SAYFA
 * ════════════════════════════════════════════════════════════════════ */

const MAX_SELECTABLE_VIDEOS = 4

export function VideoControlUnitPage() {
  const [mode, setMode] = useState<VcuThemeMode>(readStoredTheme)

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode)
    } catch {
      // localStorage kapalıysa sessizce geç
    }
  }, [mode])

  return (
    <ConfigProvider theme={mode === "dark" ? VCU_DARK_THEME : VCU_LIGHT_THEME}>
      <AntApp>
        <VcuLiveDotStyles />
        <VideoControlUnitContent mode={mode} onModeChange={setMode} />
      </AntApp>
    </ConfigProvider>
  )
}

function VideoControlUnitContent({
  mode,
  onModeChange,
}: {
  mode: VcuThemeMode
  onModeChange: (mode: VcuThemeMode) => void
}) {
  const { token } = useToken()
  const { message } = AntApp.useApp()

  const [gesbs, setGesbs] = useState(initialGesbs)
  const [search, setSearch] = useState("")
  const [kindFilter, setKindFilter] = useState<VcuVideoKind | "all">("all")
  const [dateRange, setDateRange] = useState(DEFAULT_DATE_RANGE)
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([])
  const [selectedGesbIds, setSelectedGesbIds] = useState<string[]>([])

  // Tekli/Dörtlü artık ayrı bir seçim değil — kaç video seçildiğinden
  // türetiliyor. Operatörün ayrıca mod seçmesine gerek yok, biz zaten
  // en fazla 4 videoyla sınırlıyoruz.
  const layout: VcuLayout = selectedVideoIds.length > 1 ? "quad" : "single"

  const videosById = useMemo(
    () => new Map(initialVideos.map((video) => [video.id, video])),
    [],
  )

  const filteredVideos = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("tr-TR")
    const now = new Date()
    return initialVideos.filter((video) => {
      if (kindFilter !== "all" && video.kind !== kindFilter) return false
      if (query && !video.name.toLocaleLowerCase("tr-TR").includes(query)) return false
      if (!matchesDateRange(video.date, dateRange, now)) return false
      return true
    })
  }, [search, kindFilter, dateRange])

  const liveGesbCount = gesbs.filter((g) => g.status === "live").length
  const recordedCount = initialVideos.filter((v) => v.kind === "recorded").length
  const liveVideoCount = initialVideos.filter((v) => v.kind === "live").length

  /**
   * "Gönder" butonu yok — hedeflenen GESB'ler seçimle EŞ ZAMANLI güncellenir.
   * Kartta görünmesi zaten "yüklendi" demek. Yayına almak hâlâ ayrı bir adım
   * (Başlat) — bu yüzden video değişikliği, canlıdaki bir GESB'i otomatik
   * "Yüklü"ye düşürür (yeni içerik onaylanmadan ekrana yansımaz).
   */
  function pushSelectionToGesbs(targetIds: string[], videoIds: string[]) {
    if (targetIds.length === 0 || videoIds.length === 0) return

    const slots = [0, 1, 2, 3].map((i) => videoIds[i] ?? null)
    const nextLayout: VcuLayout = videoIds.length > 1 ? "quad" : "single"

    setGesbs((prev) =>
      prev.map((g) =>
        targetIds.includes(g.id)
          ? { ...g, layout: nextLayout, slots, status: "loaded" as const }
          : g,
      ),
    )
  }

  function toggleVideo(id: string) {
    const isSelected = selectedVideoIds.includes(id)

    let next: string[]
    if (isSelected) {
      next = selectedVideoIds.filter((v) => v !== id)
    } else {
      if (selectedVideoIds.length >= MAX_SELECTABLE_VIDEOS) {
        void message.warning(`En fazla ${MAX_SELECTABLE_VIDEOS} video seçebilirsiniz.`)
        return
      }
      next = [...selectedVideoIds, id]
    }

    setSelectedVideoIds(next)
    pushSelectionToGesbs(selectedGesbIds, next)
  }

  // Bir GESB'i hedef olarak seçtiğinde iki durum var:
  //  - Staging boşsa: o GESB'de o an ne yüklüyse sol tarafa çekilir (görüp
  //    düzenleyebilesin diye).
  //  - Staging'de zaten bir seçim varsa: direkt o GESB'e basılır (anlık yükleme).
  function toggleGesbSelect(id: string) {
    const alreadySelected = selectedGesbIds.includes(id)

    if (!alreadySelected) {
      if (selectedVideoIds.length === 0) {
        const gesb = gesbs.find((g) => g.id === id)
        if (gesb && (gesb.status === "loaded" || gesb.status === "live")) {
          setSelectedVideoIds(gesb.slots.filter((slot): slot is string => slot !== null))
        }
      } else {
        pushSelectionToGesbs([id], selectedVideoIds)
      }
    }

    setSelectedGesbIds((prev) =>
      alreadySelected ? prev.filter((g) => g !== id) : [...prev, id],
    )
  }

  function handleStart(id: string) {
    setGesbs((prev) => prev.map((g) => (g.id === id ? { ...g, status: "live" as const } : g)))
  }

  function handleStop(id: string) {
    setGesbs((prev) => prev.map((g) => (g.id === id ? { ...g, status: "loaded" as const } : g)))
  }

  function handleStopAll() {
    setGesbs((prev) =>
      prev.map((g) => (g.status === "live" ? { ...g, status: "loaded" as const } : g)),
    )
    void message.success("Tüm yayınlar durduruldu.")
  }

  function handleClear(id: string) {
    setGesbs((prev) =>
      prev.map((g) =>
        g.id === id
          ? {
              ...g,
              slots: [null, null, null, null],
              layout: "single" as const,
              status: "idle" as const,
            }
          : g,
      ),
    )
    if (selectedGesbIds.includes(id)) setSelectedVideoIds([])
  }

  function handleRemoveSlot(id: string, index: number) {
    const gesb = gesbs.find((g) => g.id === id)
    if (!gesb) return

    const nextSlots = [...gesb.slots]
    nextSlots[index] = null
    const remaining = nextSlots.filter(Boolean).length

    setGesbs((prev) =>
      prev.map((g) =>
        g.id === id
          ? {
              ...g,
              slots: nextSlots,
              layout: remaining > 1 ? ("quad" as const) : ("single" as const),
              status: remaining === 0 ? ("idle" as const) : g.status,
            }
          : g,
      ),
    )

    if (selectedGesbIds.includes(id)) {
      setSelectedVideoIds(nextSlots.filter((slot): slot is string => slot !== null))
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100svh",
        overflow: "hidden",
        background: token.colorBgLayout,
        color: token.colorText,
      }}
    >
      <header
        style={{
          height: 56,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 24,
              height: 24,
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
          <Text strong style={{ fontSize: 12 }}>
            Video Kontrol Ünitesi
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            ({gesbs.length} Ekran Matrisi)
          </Text>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button
            icon={mode === "dark" ? <SunOutlined /> : <MoonOutlined />}
            onClick={() => onModeChange(mode === "dark" ? "light" : "dark")}
          >
            {mode === "dark" ? "Açık Mod" : "Koyu Mod"}
          </Button>

          <Popconfirm
            title="Tüm yayınlar durdurulsun mu?"
            description={`Şu an canlı yayında olan ${liveGesbCount} GESB yayından alınacak.`}
            okText="Tümünü Durdur"
            cancelText="Vazgeç"
            okButtonProps={{ danger: true }}
            onConfirm={handleStopAll}
            disabled={liveGesbCount === 0}
          >
            <Badge count={liveGesbCount} size="small">
              <Button
                danger
                icon={<PoweroffOutlined />}
                disabled={liveGesbCount === 0}
              >
                Tümünü Durdur
              </Button>
            </Badge>
          </Popconfirm>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
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
              placeholder="Video veya kamera ara..."
              prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
            />

            <Segmented
              block
              value={kindFilter}
              onChange={(value) => setKindFilter(value as VcuVideoKind | "all")}
              options={[
                { label: `Tümü (${initialVideos.length})`, value: "all" },
                { label: `Kayıtlı (${recordedCount})`, value: "recorded" },
                { label: `Canlı (${liveVideoCount})`, value: "live" },
              ]}
            />

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
                    slotNumber={
                      layout === "quad" && selectedIndex !== -1 ? selectedIndex + 1 : undefined
                    }
                    onToggle={() => toggleVideo(video.id)}
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
            Dokunarak seçin, hedeflediğiniz GESB'e otomatik yüklenir
          </div>
        </section>

        <aside style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <Text strong style={{ fontSize: 12 }}>
              GESB Büyük Ekranları
            </Text>
            <Text type="secondary" style={{ fontSize: 10 }}>
              (1 video = Tekli, 2-4 video = Dörtlü)
            </Text>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 12,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 12,
              alignContent: "start",
            }}
          >
            {gesbs.map((gesb) => (
              <VcuGesbCard
                key={gesb.id}
                gesb={gesb}
                videosById={videosById}
                selected={selectedGesbIds.includes(gesb.id)}
                onToggleSelect={() => toggleGesbSelect(gesb.id)}
                onStart={() => handleStart(gesb.id)}
                onStop={() => handleStop(gesb.id)}
                onClear={() => handleClear(gesb.id)}
                onRemoveSlot={(index) => handleRemoveSlot(gesb.id, index)}
              />
            ))}
          </div>
        </aside>
      </div>

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
            Seçili: {selectedVideoIds.length}/{MAX_SELECTABLE_VIDEOS}
          </Text>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {selectedVideoIds.map((id) => (
              <Tag
                key={id}
                closable
                onClose={(event) => {
                  event.preventDefault()
                  toggleVideo(id)
                }}
                style={{ marginInlineEnd: 0, fontSize: 10 }}
              >
                {videosById.get(id)?.name}
              </Tag>
            ))}
          </div>
        </div>

        <div style={{ width: 1, height: 20, background: token.colorBorderSecondary }} />

        <Tag color={layout === "quad" ? "warning" : "blue"} style={{ marginInlineEnd: 0 }}>
          {layout === "quad" ? "Dörtlü" : "Tekli"}
        </Tag>

        <div style={{ width: 1, height: 20, background: token.colorBorderSecondary }} />

        <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>
          {selectedGesbIds.length} GESB seçili
        </Text>
      </footer>
    </div>
  )
}
