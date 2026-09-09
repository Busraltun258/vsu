/**
 * ════════════════════════════════════════════════════════════════════
 *  VIDEO KONTROL ÜNİTESİ (VCU)
 *
 *  10.1" dokunmatik tablet üzerinden GESB'lere (büyük ekranlara) video
 *  dağıtımı yapan kiosk arayüzü. apps/vsu'nun TEK sayfası: rota yok,
 *  entry.tsx doğrudan bunu monte eder.
 *
 *  Tek dosyada toplandı: tüm tipler, sahte veri, tarih filtresi, tema
 *  ve bileşenler burada — antd/@ant-design/icons/dayjs dışında hiçbir
 *  iç referansı yok. Kendi <ConfigProvider>'ını ve açık/koyu paletini
 *  taşır, bu yüzden uygulamada global bir tema sağlayıcısı kurulmaz.
 *
 *  Backend'e bağlı değil — gerçek bir video matrix/switcher entegrasyonu
 *  geldiğinde "SAHTE VERİ" bölümünün yerini bir API client'ı alır.
 * ════════════════════════════════════════════════════════════════════ */

import {
  CheckOutlined,
  CloseOutlined,
  CopyOutlined,
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
  Segmented,
  Tag,
  Tooltip,
  Typography,
  theme as antdTheme,
  type ThemeConfig,
} from "antd"
import dayjs from "dayjs"
import { useEffect, useMemo, useState, type CSSProperties } from "react"

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

/**
 * ADU (operatörün kendi ekranı) tek bir "hedef" — bir GESB gibi ama kimliği,
 * konumu ve çevrimdışı hâli yok; hep var, hep kendi ekranı. Aynı slot/layout
 * şeklini kullanıyor ki VcuSlotsPreview'ı GESB kartıyla paylaşabilelim.
 */
type VcuOwnScreen = {
  status: "idle" | "loaded" | "live"
  layout: VcuLayout
  slots: (string | null)[]
}

/* ════════════════════════════════════════════════════════════════════
 *  SAHTE VERİ
 * ════════════════════════════════════════════════════════════════════ */

const initialVideos: VcuVideoSource[] = [
  { id: "v1", name: "Opcon 1", kind: "recorded", duration: "04:12", date: "2026-09-06" },
  { id: "v2", name: "Opcon 2", kind: "recorded", duration: "01:45", date: "2026-09-02" },
  { id: "v3", name: "Opcon 3", kind: "recorded", duration: "06:30", date: "2026-09-05" },
  { id: "v4", name: "Kamera 01 · Ana Sahne", kind: "live" },
  { id: "v5", name: "Sensör 02 · Ana Sahne", kind: "live" },
  { id: "v6", name: "Kamera 03 · Salon Genel", kind: "live" },
  { id: "v7", name: "Opcon 4", kind: "recorded", duration: "03:05", date: "2026-09-01" },
  { id: "v8", name: "Opcon 5", kind: "recorded", duration: "08:20", date: "2026-08-15" },
  { id: "v9", name: "Sensör 04 · Fuaye", kind: "live" },
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
  { id: "v12", name: "Kamera 05 · Giriş Holü", kind: "live" },
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
  /** Kayıtlı videolar kataloğundaki sırası (1, 2, 3...). Canlı kaynaklarda undefined. */
  orderNumber?: number
  onToggle: () => void
}

function VcuVideoRow({ video, selected, slotNumber, orderNumber, onToggle }: VcuVideoRowProps) {
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
          orderNumber !== undefined ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              <Text style={{ fontSize: 12, fontWeight: 600, flexShrink: 0 }}>Opcon {orderNumber}</Text>
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
  /** Kopyalama işleminin kaynağı olarak işaretli mi (kopya modu aktif). */
  copySource: boolean
  /** Kopyalanacak içerik yoksa (boş GESB) kopya düğmesi pasif. */
  copyDisabled: boolean
  onToggleSelect: () => void
  onCopy: () => void
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

/* ════════════════════════════════════════════════════════════════════
 *  SLOT ÖNİZLEME — GESB kartı ve "Bu Ekran" (ADU) kartı bunu paylaşır
 * ════════════════════════════════════════════════════════════════════ */

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
}

function VcuSlotsPreview({
  slots,
  videosById,
  emptyActive,
  emptyHint,
  removeDisabled,
  onRemoveSlot,
  fill,
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
                  {isLiveVideo ? "● Canlı Akış" : "Kayıtlı · Tekli (1x1)"}
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
            return (
              <div
                key={video.id}
                style={{
                  display: "flex",
                  // Hücre (grid item) fill modunda tam yüksekliğe geriliyor;
                  // alignItems:"center" etiketi/çarpıyı hücrenin dikey ortasına
                  // düşürüyordu — sabit üstte kalması için flex-start.
                  alignItems: fill ? "flex-start" : "center",
                  justifyContent: "space-between",
                  gap: 4,
                  borderRadius: token.borderRadiusSM,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  background: token.colorBgContainer,
                  padding: fill ? "8px 10px" : "4px 6px",
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

function VcuGesbCard({
  gesb,
  videosById,
  selected,
  copySource,
  copyDisabled,
  onToggleSelect,
  onCopy,
  onStart,
  onStop,
  onClear,
  onRemoveSlot,
}: VcuGesbCardProps) {
  const { token } = useToken()
  const { modal } = AntApp.useApp()
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
        borderColor: copySource ? token.colorWarning : selected ? token.colorPrimary : undefined,
        background: copySource ? token.colorWarningBg : selected ? token.colorPrimaryBg : undefined,
      }}
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
          <Tooltip title="Bu GESB'in içeriğini başka bir GESB'e kopyalar: dokunun, sonra hedef GESB'e dokunun.">
            <Button
              type="text"
              disabled={isOffline || copyDisabled}
              icon={
                <CopyOutlined style={{ fontSize: 16, color: copySource ? token.colorWarning : undefined }} />
              }
              onClick={(event) => {
                event.stopPropagation()
                onCopy()
              }}
              style={{ padding: "0 8px", marginInlineStart: -8 }}
            />
          </Tooltip>
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
      <VcuSlotsPreview
        slots={gesb.slots}
        videosById={videosById}
        emptyActive={selected}
        emptyHint={selected ? "Video seçin, buraya yüklenecek" : "Hedeflemek için dokunun"}
        removeDisabled={isLive}
        onRemoveSlot={onRemoveSlot}
      />

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
            disabled={filledCount === 0 || isLive}
            onClick={(event) => {
              event.stopPropagation()
              modal.confirm({
                title: "Bu GESB temizlensin mi?",
                content: `${gesb.name} üzerindeki içerik kaldırılacak.`,
                okText: "Temizle",
                cancelText: "Vazgeç",
                okButtonProps: { danger: true },
                onOk: onClear,
              })
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
 *  "BU EKRAN" KARTI — ADU görünümü (>1250px). GESB grid'inin yerine geçer:
 *  hedefleme/kopyalama yok, tek bir hedef var — operatörün kendi ekranı.
 * ════════════════════════════════════════════════════════════════════ */

type VcuOwnScreenCardProps = {
  ownScreen: VcuOwnScreen
  videosById: Map<string, VcuVideoSource>
  onStart: () => void
  onStop: () => void
  onClear: () => void
  onRemoveSlot: (index: number) => void
}

function VcuOwnScreenCard({
  ownScreen,
  videosById,
  onStart,
  onStop,
  onClear,
  onRemoveSlot,
}: VcuOwnScreenCardProps) {
  const { token } = useToken()
  const { modal } = AntApp.useApp()
  const isLive = ownScreen.status === "live"
  const filledCount = ownScreen.slots.filter(Boolean).length

  const modeTag =
    filledCount === 0 ? (
      <Tag color="default">Boş</Tag>
    ) : filledCount === 1 ? (
      <Tag color="blue">Tekli (1x1)</Tag>
    ) : (
      <Tag color="warning">Dörtlü ({filledCount}/4)</Tag>
    )

  // antd <Card> bilerek KULLANILMADI: .ant-card-body varsayılan olarak flex
  // konteyner değil, bu yüzden içindeki VcuSlotsPreview'in flex:1 (fill)
  // yüksekliği hiçbir işe yaramıyordu — içerik kartın ortasında küçük kalıyordu.
  // Düz div'lerle tüm flex zincirini kendimiz kuruyoruz ki tam yüksekliği kaplasın.
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: token.borderRadius,
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "10px 14px",
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, minWidth: 0 }}>
          <span
            className={isLive ? "vcu-live-dot" : undefined}
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: isLive ? token.colorError : filledCount > 0 ? token.colorWarning : token.colorTextQuaternary,
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <span>Bu Ekran</span>
          <Text type="secondary" style={{ fontWeight: 400, fontSize: 11 }}>
            (ADU — yalnızca kendi ekranın)
          </Text>
        </div>
        {modeTag}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: 14 }}>
        <VcuSlotsPreview
          slots={ownScreen.slots}
          videosById={videosById}
          emptyActive={false}
          emptyHint="Soldan video seçin, bu ekranda oynayacak"
          removeDisabled={isLive}
          onRemoveSlot={onRemoveSlot}
          fill
        />
      </div>

      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
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
            onClick={() => {
              if (!isLive) onStart()
            }}
          >
            {isLive ? "Oynatılıyor" : "Başlat"}
          </Button>

          <Button disabled={!isLive} icon={<PauseOutlined />} onClick={onStop}>
            Durdur
          </Button>
        </div>

        <Button
          type="text"
          disabled={filledCount === 0 || isLive}
          onClick={() => {
            modal.confirm({
              title: "Bu ekran temizlensin mi?",
              content: "Yüklü içerik kaldırılacak.",
              okText: "Temizle",
              cancelText: "Vazgeç",
              okButtonProps: { danger: true },
              onOk: onClear,
            })
          }}
        >
          Temizle
        </Button>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
 *  SAYFA
 * ════════════════════════════════════════════════════════════════════ */

/** Bu genişlikten büyük ekranlarda ADU (operatörün kendi ekranı) görünümüne geçilir. */
const ADU_BREAKPOINT = 1250

/**
 * "auto" genişliğe bakar (varsayılan). Operatör bir pencereyi ikinci monitöre
 * taşırken/yeniden boyutlandırırken genişlik eşiği sessizce aşılıp görünüm
 * beklenmedik anda değişebiliyordu — "tablet"/"own" bunu manuel sabitler.
 */
type VcuViewOverride = "auto" | "tablet" | "own"

const VIEW_OVERRIDE_STORAGE_KEY = "vsu:vcu-mockup-view-override"

function readStoredViewOverride(): VcuViewOverride {
  try {
    const stored = window.localStorage.getItem(VIEW_OVERRIDE_STORAGE_KEY)
    return stored === "tablet" || stored === "own" ? stored : "auto"
  } catch {
    return "auto"
  }
}

function useIsAduView(override: VcuViewOverride): boolean {
  const [isWide, setIsWide] = useState(() => window.innerWidth > ADU_BREAKPOINT)

  useEffect(() => {
    const handleResize = () => setIsWide(window.innerWidth > ADU_BREAKPOINT)
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  if (override === "tablet") return false
  if (override === "own") return true
  return isWide
}

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
  const { message, modal } = AntApp.useApp()

  /** "Oto" seçiliyken genişliğe göre; "Tablet"/"Kendi Ekranım" seçiliyken sabit. */
  const [viewOverride, setViewOverride] = useState<VcuViewOverride>(readStoredViewOverride)

  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_OVERRIDE_STORAGE_KEY, viewOverride)
    } catch {
      // localStorage kapalıysa sessizce geç
    }
  }, [viewOverride])

  /**
   * >1250px (ya da manuel "Kendi Ekranım" seçimi): ADU görünümü. Aynı sayfa,
   * aynı sol kütüphane/tema/bileşenler — sağ taraf GESB grid'i yerine tek bir
   * "Bu Ekran" kartına dönüşür: hedefleme/kopyalama yok, video seçimi
   * doğrudan kendi ekranına yüklenir (bkz. toggleVideo).
   */
  const isAduView = useIsAduView(viewOverride)

  const [gesbs, setGesbs] = useState(initialGesbs)
  const [ownScreen, setOwnScreen] = useState<VcuOwnScreen>({
    status: "idle",
    layout: "single",
    slots: [null, null, null, null],
  })
  const [search, setSearch] = useState("")
  const [kindFilter, setKindFilter] = useState<VcuVideoKind | "all">("all")
  const [dateRange, setDateRange] = useState(DEFAULT_DATE_RANGE)
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([])
  /** O an hedeflenen TEK GESB — aynı anda birden fazla GESB hedeflenemez. ADU'da kullanılmaz. */
  const [selectedGesbId, setSelectedGesbId] = useState<string | null>(null)
  /** Kopya modunda "kaynak" olarak işaretlenen GESB. Dolu olduğunda bir sonraki
   *  GESB dokunuşu hedef seçmek yerine bu GESB'in içeriğini oraya yapıştırır. */
  const [copySourceId, setCopySourceId] = useState<string | null>(null)

  // Tablet <-> ADU arası geçişte (pencere yeniden boyutlanınca) staging'i
  // sıfırla — bir GESB için seçilmiş videoların yanlışlıkla "Bu Ekran"a ya da
  // tersine sızmaması için.
  useEffect(() => {
    setSelectedVideoIds([])
    setSelectedGesbId(null)
    setCopySourceId(null)
  }, [isAduView])

  // Tekli/Dörtlü artık ayrı bir seçim değil — kaç video seçildiğinden
  // türetiliyor. Operatörün ayrıca mod seçmesine gerek yok, biz zaten
  // en fazla 4 videoyla sınırlıyoruz.
  const layout: VcuLayout = selectedVideoIds.length > 1 ? "quad" : "single"

  const videosById = useMemo(
    () => new Map(initialVideos.map((video) => [video.id, video])),
    [],
  )

  /** Kayıtlı videoları katalog sırasına göre numaralandırır (1, 2, 3...); canlı kaynaklarda karşılık yok. */
  const recordedIndexById = useMemo(() => {
    const map = new Map<string, number>()
    let count = 0
    for (const video of initialVideos) {
      if (video.kind === "recorded") {
        count += 1
        map.set(video.id, count)
      }
    }
    return map
  }, [])

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
   * "Gönder" butonu yok — hedeflenen TEK GESB seçimle EŞ ZAMANLI güncellenir.
   * Kartta görünmesi zaten "yüklendi" demek. Yayına almak hâlâ ayrı bir adım
   * (Başlat) — bu yüzden video değişikliği, canlıdaki bir GESB'i otomatik
   * "Yüklü"ye düşürür (yeni içerik onaylanmadan ekrana yansımaz).
   */
  function pushSelectionToGesb(targetId: string, videoIds: string[]) {
    if (videoIds.length === 0) return

    const slots = [0, 1, 2, 3].map((i) => videoIds[i] ?? null)
    const nextLayout: VcuLayout = videoIds.length > 1 ? "quad" : "single"

    setGesbs((prev) =>
      prev.map((g) =>
        g.id === targetId ? { ...g, layout: nextLayout, slots, status: "loaded" as const } : g,
      ),
    )
  }

  /** ADU'da hedefleme adımı yok — "Bu Ekran" tek hedef, seçim doğrudan ona yüklenir. */
  function pushSelectionToOwnScreen(videoIds: string[]) {
    if (videoIds.length === 0) return

    const slots = [0, 1, 2, 3].map((i) => videoIds[i] ?? null)
    const nextLayout: VcuLayout = videoIds.length > 1 ? "quad" : "single"

    setOwnScreen((prev) => ({ ...prev, layout: nextLayout, slots, status: "loaded" }))
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
    if (isAduView) {
      pushSelectionToOwnScreen(next)
    } else if (selectedGesbId) {
      pushSelectionToGesb(selectedGesbId, next)
    }
  }

  function handleOwnStart() {
    setOwnScreen((prev) => ({ ...prev, status: "live" }))
  }

  function handleOwnStop() {
    setOwnScreen((prev) => ({ ...prev, status: "loaded" }))
  }

  function handleOwnClear() {
    setOwnScreen({ status: "idle", layout: "single", slots: [null, null, null, null] })
    setSelectedVideoIds([])
  }

  function handleOwnRemoveSlot(index: number) {
    const nextSlots = [...ownScreen.slots]
    nextSlots[index] = null
    const remaining = nextSlots.filter(Boolean).length

    setOwnScreen((prev) => ({
      ...prev,
      slots: nextSlots,
      layout: remaining > 1 ? ("quad" as const) : ("single" as const),
      status: remaining === 0 ? ("idle" as const) : prev.status,
    }))
    setSelectedVideoIds(nextSlots.filter((slot): slot is string => slot !== null))
  }

  /**
   * Bir GESB kartına dokunmanın iki farklı anlamı olabilir:
   *  - Kopya modu aktifse (copySourceId dolu): bu GESB HEDEF olur, kaynağın
   *    içeriği doğrudan buraya yapıştırılır ve kopya modu kapanır. Kaynağa
   *    tekrar dokunmak kopya modunu iptal eder.
   *  - Değilse: bu GESB yeni "hedef" olur ve soldaki kütüphane HER SEFERİNDE
   *    o GESB'in KENDİ o anki içeriğini yansıtır (dolu slotlar seçili görünür).
   *    Böylece hangi GESB'e gidilirse gidilsin orada ne varsa onu görüp
   *    düzenleyebilirsin — ama önceki hedeflenen GESB'nin seçimi asla buraya
   *    sızmaz, her GESB kendi gerçek durumundan okunur. Zaten hedef olan
   *    karta TEKRAR dokunmak hiçbir şey yapmaz.
   */
  function handleGesbTap(id: string) {
    if (copySourceId) {
      if (copySourceId !== id) pasteGesbContent(copySourceId, id)
      setCopySourceId(null)
      return
    }

    if (selectedGesbId === id) return

    const target = gesbs.find((g) => g.id === id)
    setSelectedGesbId(id)
    setSelectedVideoIds(target ? target.slots.filter((slot): slot is string => slot !== null) : [])
  }

  /** Kopya simgesine dokunma: bu GESB'i kopya kaynağı yapar (tekrar dokunmak iptal eder). */
  function handleCopyClick(id: string) {
    setSelectedGesbId(null)
    setSelectedVideoIds([])
    setCopySourceId((prev) => (prev === id ? null : id))
    if (copySourceId !== id) {
      void message.info("Şimdi içeriğin yapıştırılacağı GESB'e dokunun.")
    }
  }

  function pasteGesbContent(sourceId: string, targetId: string) {
    const source = gesbs.find((g) => g.id === sourceId)
    if (!source) return

    setGesbs((prev) =>
      prev.map((g) =>
        g.id === targetId
          ? {
            ...g,
            slots: [...source.slots],
            layout: source.layout,
            status: source.slots.some(Boolean) ? ("loaded" as const) : g.status,
          }
          : g,
      ),
    )
    void message.success(`${source.name} içeriği ${gesbs.find((g) => g.id === targetId)?.name} GESB'ine kopyalandı.`)
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
    if (selectedGesbId === id) setSelectedVideoIds([])
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

    if (selectedGesbId === id) {
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
            {isAduView ? "(ADU — Kendi Ekranın)" : `(${gesbs.length} Ekran Matrisi)`}
          </Text>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Tooltip title="Görünüm genişliğe göre otomatik değişir; pencere yeniden boyutlandığında beklenmedik geçişi önlemek için sabitleyebilirsiniz.">
            <Segmented
              value={viewOverride}
              onChange={(value) => setViewOverride(value as VcuViewOverride)}
              options={[
                { label: "Oto", value: "auto" },
                { label: "Tablet", value: "tablet" },
                { label: "Ekranım", value: "own" },
              ]}
            />
          </Tooltip>

          <Button
            icon={mode === "dark" ? <SunOutlined /> : <MoonOutlined />}
            onClick={() => onModeChange(mode === "dark" ? "light" : "dark")}
          >
            {mode === "dark" ? "Açık Mod" : "Koyu Mod"}
          </Button>

          {!isAduView && (
            <Badge count={liveGesbCount} size="small">
              <Button
                danger
                icon={<PoweroffOutlined />}
                disabled={liveGesbCount === 0}
                onClick={() => {
                  modal.confirm({
                    title: "Tüm yayınlar durdurulsun mu?",
                    content: `Şu an canlı yayında olan ${liveGesbCount} GESB yayından alınacak.`,
                    okText: "Tümünü Durdur",
                    cancelText: "Vazgeç",
                    okButtonProps: { danger: true },
                    onOk: handleStopAll,
                  })
                }}
              >
                Tümünü Durdur
              </Button>
            </Badge>
          )}
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
                    orderNumber={recordedIndexById.get(video.id)}
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
            {isAduView
              ? "Dokunarak seçin, bu ekranda oynayacak"
              : "Dokunarak seçin, hedeflediğiniz GESB'e otomatik yüklenir"}
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
              {isAduView ? "Bu Ekran" : "GESB Büyük Ekranları"}
            </Text>
            <Text type="secondary" style={{ fontSize: 10 }}>
              (1 video = Tekli, 2-4 video = Dörtlü)
            </Text>
            {!isAduView && copySourceId && (
              <Text type="warning" style={{ fontSize: 10, marginInlineStart: "auto" }}>
                Kopyalanacak: {gesbs.find((g) => g.id === copySourceId)?.name} — hedef GESB'e
                dokunun (iptal için kopya simgesine tekrar dokunun)
              </Text>
            )}
          </div>

          {isAduView ? (
            <div
              style={{
                flex: 1,
                overflow: "hidden",
                padding: 16,
                display: "flex",
              }}
            >
              <VcuOwnScreenCard
                ownScreen={ownScreen}
                videosById={videosById}
                onStart={handleOwnStart}
                onStop={handleOwnStop}
                onClear={handleOwnClear}
                onRemoveSlot={handleOwnRemoveSlot}
              />
            </div>
          ) : (
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
                  selected={selectedGesbId === gesb.id}
                  copySource={copySourceId === gesb.id}
                  copyDisabled={gesb.slots.every((slot) => !slot)}
                  onToggleSelect={() => handleGesbTap(gesb.id)}
                  onCopy={() => handleCopyClick(gesb.id)}
                  onStart={() => handleStart(gesb.id)}
                  onStop={() => handleStop(gesb.id)}
                  onClear={() => handleClear(gesb.id)}
                  onRemoveSlot={(index) => handleRemoveSlot(gesb.id, index)}
                />
              ))}
            </div>
          )}
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
          {isAduView
            ? ownScreen.status === "live"
              ? "Bu ekran: Oynatılıyor"
              : ownScreen.status === "loaded"
                ? "Bu ekran: Yüklü"
                : "Bu ekran: Boş"
            : selectedGesbId
              ? `Hedef: ${gesbs.find((g) => g.id === selectedGesbId)?.name}`
              : "Hedef GESB seçilmedi"}
        </Text>
      </footer>
    </div>
  )
}
