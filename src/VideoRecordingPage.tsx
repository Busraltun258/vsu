/**
 * ════════════════════════════════════════════════════════════════════
 *  VİDEO KAYIT SAYFASI — kaynakların kaydını alma ekranı
 *
 *  Kayıt alınabilen TÜM kaynaklar listelenir: opcon konsolları, kameralar,
 *  sensörler, radarlar. Her satır/kart kendi kaydını yönetir.
 *
 *  İKİ GÖRÜNÜM (sağ üstteki anahtar):
 *   · KART (varsayılan) — sayfalı yatay şerit. Kayıt ekranı normal
 *     bilgisayarda açıldığı için genişlik sorun değil, kartlar daha okunur.
 *   · LİSTE — tek satır = tek kaynak, düz dikey kaydırma. 30+ kaynakta
 *     "hangi kaynak nerede, kayıtta mı" taraması için çok daha hızlı.
 *
 *  BAŞLATMA AKIŞI: her iki görünümde de "Başlat" bir MODAL açar; etiketler ve
 *  süre orada girilir. Eskiden bunlar her kartın içinde duruyordu — kartları
 *  gereksiz büyütüyor ve "etiket girmeden Başlat pasif" kuralını görünmez
 *  kılıyordu. Modal bunu açık bir adıma çevirdi.
 *
 *  ETİKET KURALI: en az 1, en fazla MAX_RECORD_TAGS etiket. Kayıt dururken
 *  oluşan video bu etiketlerle kütüphaneye düşer; "Kayıtlı" sekmesinde
 *  etikete göre aranıp filtrelenir. Hazır öneri listesi YOK: kutu boş açılır,
 *  operatörün bu oturumda yazdığı etiketler biriktirilip sonraki kayıtlara
 *  öneri olarak sunulur (knownTags).
 *
 *  SÜRE KURALI: saat + dakika seçilebilir. Süre dolunca kayıt KENDİLİĞİNDEN
 *  durur ve kütüphaneye düşer; sayaç geri sayar. 0sa 0dk seçilirse süre
 *  sınırı yoktur, kayıt yalnızca elle durdurulur. Her durumda operatör
 *  istediği an "Durdur" diyebilir.
 * ════════════════════════════════════════════════════════════════════ */

import {
  AppstoreOutlined,
  PoweroffOutlined,
  SearchOutlined,
  TagsOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons"
import {
  App as AntApp,
  Button,
  Card,
  Input,
  Modal,
  Segmented,
  Select,
  Tag,
  Tooltip,
  Typography,
  theme as antdTheme,
} from "antd"
import dayjs from "dayjs"
import { useEffect, useMemo, useRef, useState, type UIEvent } from "react"

import {
  MAX_RECORD_TAGS,
  RECORD_SOURCE_META,
  RECORD_SOURCE_ORDER,
  VcuHeader,
  VcuThemeSelect,
  formatDuration,
  type VcuPageKey,
  type VcuRecordSource,
  type VcuRecordSourceType,
  type VcuRecording,
  type VcuRole,
  type VcuThemeMode,
} from "./vcuShared"

const { useToken } = antdTheme
const { Text } = Typography

/** Süre seçicisindeki saat seçenekleri. */
const HOUR_OPTIONS = Array.from({ length: 13 }, (_, h) => ({ label: `${h} sa`, value: h }))

/** Süre seçicisindeki dakika seçenekleri — dakika hassasiyetinde tam liste. */
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, m) => ({ label: `${m} dk`, value: m }))

type VcuRecordView = "list" | "card"

/* ════════════════════════════════════════════════════════════════════
 *  ORTAK PARÇALAR — liste satırı ve kart aynı bilgiyi gösterir
 * ════════════════════════════════════════════════════════════════════ */

/** Kaynağın durum noktası: kayıtta kırmızı (nabız), çevrimdışı gri, hazır yeşil. */
function StatusDot({ recording, online }: { recording: VcuRecording | null; online: boolean }) {
  const { token } = useToken()
  return (
    <span
      className={recording ? "vcu-live-dot" : undefined}
      style={{
        width: 8,
        height: 8,
        flexShrink: 0,
        borderRadius: 999,
        display: "inline-block",
        background: recording
          ? token.colorError
          : online
            ? token.colorSuccess
            : token.colorTextQuaternary,
      }}
    />
  )
}

/**
 * Süren kaydın sayacı. Süre sınırı varsa GERİ SAYAR (kalan süre), yoksa geçen
 * süreyi ileri sayar. `compact` liste satırı için — tek satıra sığar.
 */
function RecordCounter({
  recording,
  now,
  compact,
}: {
  recording: VcuRecording
  now: number
  compact?: boolean
}) {
  const { token } = useToken()
  const elapsed = Math.floor((now - recording.startedAt) / 1000)
  const planned = recording.plannedSeconds ?? 0
  const remaining = planned > 0 ? Math.max(0, planned - elapsed) : null

  if (compact) {
    return (
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexShrink: 0 }}>
        <Text
          style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 600, color: token.colorError }}
        >
          {formatDuration(remaining ?? elapsed)}
        </Text>
        <Text type="secondary" style={{ fontSize: 9 }}>
          {remaining === null ? "geçen" : `kalan · ${formatDuration(planned)}`}
        </Text>
      </div>
    )
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 8,
        padding: "8px 10px",
        borderRadius: token.borderRadius,
        border: `1px solid ${token.colorErrorBorder}`,
        background: token.colorBgContainer,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <Text type="secondary" style={{ fontSize: 9, letterSpacing: 0.5, textTransform: "uppercase" }}>
          {remaining === null ? "Geçen süre" : "Kalan süre"}
        </Text>
        <Text
          style={{
            fontFamily: "monospace",
            fontSize: 20,
            fontWeight: 600,
            lineHeight: 1.1,
            color: token.colorError,
          }}
        >
          {formatDuration(remaining ?? elapsed)}
        </Text>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
        <Text type="secondary" style={{ fontSize: 10 }}>
          {dayjs(recording.startedAt).format("HH:mm:ss")}
        </Text>
        <Text type="secondary" style={{ fontSize: 10 }}>
          {remaining === null
            ? "Süresiz"
            : `${formatDuration(elapsed)} / ${formatDuration(planned)}`}
        </Text>
      </div>
    </div>
  )
}

/** Kaydın etiket rozetleri (kayıt sürerken değiştirilemez). */
function RecordTags({ tags, compact }: { tags: string[]; compact?: boolean }) {
  const { token } = useToken()
  if (tags.length === 0) return null
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 3, minWidth: 0 }}>
      <TagsOutlined style={{ fontSize: 10, color: token.colorTextTertiary, flexShrink: 0 }} />
      {tags.map((tag) => (
        <Tag
          key={tag}
          color="blue"
          bordered={false}
          style={{ marginInlineEnd: 0, fontSize: compact ? 9 : 10, lineHeight: "16px" }}
        >
          {tag}
        </Tag>
      ))}
    </div>
  )
}

/** Başlat / Durdur düğmesi — iki görünümde de aynı davranış. */
function RecordActionButton({
  recording,
  online,
  size,
  onStart,
  onStop,
}: {
  recording: VcuRecording | null
  online: boolean
  size?: "small"
  onStart: () => void
  onStop: () => void
}) {
  const { token } = useToken()

  if (recording) {
    return (
      <Button danger type="primary" size={size} icon={<PoweroffOutlined />} onClick={onStop}>
        Durdur
      </Button>
    )
  }

  return (
    <Tooltip title={online ? "" : "Kaynak bağlı değil"}>
      {/* disabled butonda Tooltip tetiklenmediği için sarmalayıcı span */}
      <span>
        <Button
          size={size}
          disabled={!online}
          icon={<span style={{ fontSize: 11 }}>●</span>}
          style={
            online
              ? { background: token.colorError, borderColor: token.colorError, color: "#fff" }
              : undefined
          }
          onClick={onStart}
        >
          Başlat
        </Button>
      </span>
    </Tooltip>
  )
}

/* ════════════════════════════════════════════════════════════════════
 *  LİSTE SATIRI (varsayılan görünüm)
 * ════════════════════════════════════════════════════════════════════ */

type VcuRecordRowProps = {
  source: VcuRecordSource
  recording: VcuRecording | null
  now: number
  onStart: () => void
  onStop: () => void
}

function VcuRecordRow({ source, recording, now, onStart, onStop }: VcuRecordRowProps) {
  const { token } = useToken()
  const meta = RECORD_SOURCE_META[source.type]
  const isOffline = !source.online

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        minHeight: 52,
        borderRadius: token.borderRadius,
        border: `1px solid ${recording ? token.colorErrorBorder : token.colorBorderSecondary}`,
        background: recording ? token.colorErrorBg : token.colorBgContainer,
        opacity: isOffline ? 0.6 : 1,
      }}
    >
      <StatusDot recording={recording} online={source.online} />

      <Tag icon={meta.icon} color={meta.color} style={{ marginInlineEnd: 0, flexShrink: 0 }}>
        {meta.label}
      </Tag>

      <div style={{ minWidth: 0, flex: 1 }}>
        <Text style={{ fontSize: 12, fontWeight: 500 }} ellipsis>
          {source.name}
        </Text>
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <Text type="secondary" style={{ fontSize: 10, flexShrink: 0 }}>
            {source.location}
          </Text>
          {recording && <RecordTags tags={recording.tags} compact />}
        </div>
      </div>

      {recording && <RecordCounter recording={recording} now={now} compact />}

      {isOffline && !recording && (
        <Text type="secondary" style={{ fontSize: 10, flexShrink: 0 }}>
          Bağlı değil
        </Text>
      )}

      <div style={{ flexShrink: 0 }}>
        <RecordActionButton
          recording={recording}
          online={source.online}
          size="small"
          onStart={onStart}
          onStop={onStop}
        />
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
 *  KART (alternatif görünüm)
 *
 *  Etiket/süre kutuları modal'a taşındığı için kart artık KOMPAKT: başlık,
 *  durum ve tek bir eylem düğmesi. Eskiden ~280px'ti, 10.1" ekranda sayfa
 *  başına çok az kart düşüyordu.
 * ════════════════════════════════════════════════════════════════════ */

type VcuRecordCardProps = {
  source: VcuRecordSource
  recording: VcuRecording | null
  now: number
  onStart: () => void
  onStop: () => void
}

function VcuRecordCard({ source, recording, now, onStart, onStop }: VcuRecordCardProps) {
  const { token } = useToken()
  const meta = RECORD_SOURCE_META[source.type]
  const isOffline = !source.online

  return (
    <Card
      size="small"
      style={{
        opacity: isOffline ? 0.6 : 1,
        borderColor: recording ? token.colorError : undefined,
        background: recording ? token.colorErrorBg : undefined,
      }}
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <StatusDot recording={recording} online={source.online} />
          <Text strong style={{ fontSize: 12, minWidth: 0 }} ellipsis>
            {source.name}
          </Text>
        </div>
      }
      extra={
        <Tag icon={meta.icon} color={meta.color} style={{ marginInlineEnd: 0 }}>
          {meta.label}
        </Tag>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {recording ? (
          <>
            <RecordCounter recording={recording} now={now} />
            <RecordTags tags={recording.tags} />
          </>
        ) : (
          <Text type="secondary" style={{ fontSize: 11 }}>
            {isOffline
              ? "Kaynak bağlı değil — kayıt alınamaz."
              : `${source.location} · Başlat'a dokunun, etiket ve süreyi girin.`}
          </Text>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            paddingTop: 6,
            borderTop: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <RecordActionButton
            recording={recording}
            online={source.online}
            onStart={onStart}
            onStop={onStop}
          />
          <Text type="secondary" style={{ fontSize: 10, textAlign: "right" }}>
            {recording ? "Durunca kütüphaneye düşer" : source.location}
          </Text>
        </div>
      </div>
    </Card>
  )
}

/* ════════════════════════════════════════════════════════════════════
 *  YATAY SAYFALI ŞERİT — Instagram hikâye mantığı: kaynaklar sabit boyutlu
 *  "sayfalara" bölünür, tablet parmakla yana kaydırır (native touch scroll +
 *  CSS scroll-snap — JS'te kaydırma taklit edilmiyor), altta nokta göstergesi
 *  hangi sayfada olunduğunu gösterir ve dokununca o sayfaya kayar.
 *
 *  Yalnızca KART görünümünde kullanılır; listede düz dikey kaydırma var.
 * ════════════════════════════════════════════════════════════════════ */

/** Kart görünümünde bir sayfada gösterilen kart sayısı. */
const RECORD_PAGE_SIZE = 8

function chunk<T>(items: T[], size: number): T[][] {
  const pages: T[][] = []
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size))
  return pages
}

/* ════════════════════════════════════════════════════════════════════
 *  SAYFA
 * ════════════════════════════════════════════════════════════════════ */

type VideoRecordingPageProps = {
  mode: VcuThemeMode
  onModeChange: (mode: VcuThemeMode) => void
  page: VcuPageKey
  role: VcuRole
  sources: VcuRecordSource[]
  recordings: VcuRecording[]
  /** `plannedSeconds` 0 ise süresiz kayıt — yalnızca elle durdurulur. */
  onStartRecording: (sourceId: string, tags: string[], plannedSeconds: number) => void
  onStopRecording: (sourceId: string) => void
  onStopAllRecordings: () => void
}

export function VideoRecordingPage({
  mode,
  onModeChange,
  page,
  role,
  sources,
  recordings,
  onStartRecording,
  onStopRecording,
  onStopAllRecordings,
}: VideoRecordingPageProps) {
  const { token } = useToken()
  const { modal } = AntApp.useApp()

  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<VcuRecordSourceType | "all">("all")
  /**
   * Kart varsayılan. Kayıt ekranı normal bilgisayarda açıldığı için genişlik
   * sorun değil; kartlar daha okunur. Yoğun tarama gerektiğinde operatör
   * sağ üstteki anahtarla listeye geçer.
   */
  const [view, setView] = useState<VcuRecordView>("card")
  /**
   * Etiket kutusunun seçenekleri. Hazır öneri listesi BİLEREK YOK — burası boş
   * başlar ve operatör etiket yazdıkça dolar, böylece aynı etiketi ikinci kez
   * yazmak yerine listeden seçebilir. Oturum boyunca yaşar (mockup); gerçek
   * entegrasyonda kütüphanedeki mevcut etiketlerden beslenecek.
   */
  const [knownTags, setKnownTags] = useState<string[]>([])
  /** Sayaçları saniyede bir ilerleten zaman damgası. */
  const [now, setNow] = useState(() => Date.now())

  /** Başlatma modal'ının hedefi — null ise modal kapalı. */
  const [startTarget, setStartTarget] = useState<VcuRecordSource | null>(null)
  const [formTags, setFormTags] = useState<string[]>([])
  /** Modal'daki süre, saniye. 0 → süresiz. */
  const [formSeconds, setFormSeconds] = useState(0)

  const recordingBySourceId = useMemo(
    () => new Map(recordings.map((recording) => [recording.sourceId, recording])),
    [recordings],
  )

  // Sayaç yalnızca aktif kayıt varken dönsün — boş ekranda saniyelik
  // yeniden render etmenin anlamı yok.
  useEffect(() => {
    if (recordings.length === 0) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [recordings.length])

  /**
   * Süresi dolan kayıtları otomatik durdurur. Sayaç zaten saniyede bir `now`u
   * güncelliyor; burada yalnızca süresi dolanları süzüyoruz. Süresiz kayıtlar
   * (plannedSeconds 0) hiç dokunulmadan geçer.
   *
   * DİKKAT — bu MOCKUP davranışı: süreyi tarayıcı takip ediyor, dolayısıyla
   * sekme kapalıyken kayıt kendiliğinden durmaz. Gerçek entegrasyonda süreyi
   * backend tutmalı (bkz. docs/VSU_BACKEND_API.md soru 14).
   */
  useEffect(() => {
    for (const recording of recordings) {
      const planned = recording.plannedSeconds ?? 0
      if (planned <= 0) continue
      if (now - recording.startedAt >= planned * 1000) {
        onStopRecording(recording.sourceId)
      }
    }
  }, [now, recordings, onStopRecording])

  const filteredSources = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("tr-TR")
    return sources.filter((source) => {
      if (typeFilter !== "all" && source.type !== typeFilter) return false
      if (query) {
        const haystack = `${source.name} ${source.location}`.toLocaleLowerCase("tr-TR")
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }, [sources, search, typeFilter])

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const source of sources) counts[source.type] = (counts[source.type] ?? 0) + 1
    return counts
  }, [sources])

  const pages = useMemo(() => chunk(filteredSources, RECORD_PAGE_SIZE), [filteredSources])

  const carouselRef = useRef<HTMLDivElement>(null)
  const [currentPage, setCurrentPage] = useState(0)

  // Filtre ya da görünüm değişince sayfa sayısı da değişir — en başa dön,
  // yoksa "3. sayfadaydım" durumu artık var olmayan bir sayfayı gösterebilir.
  useEffect(() => {
    setCurrentPage(0)
    carouselRef.current?.scrollTo({ left: 0 })
  }, [search, typeFilter, view])

  function handleCarouselScroll(event: UIEvent<HTMLDivElement>) {
    const el = event.currentTarget
    const width = el.clientWidth || 1
    const index = Math.round(el.scrollLeft / width)
    setCurrentPage((prev) => (prev === index ? prev : index))
  }

  function scrollToPage(index: number) {
    const el = carouselRef.current
    if (!el) return
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" })
  }

  /** "Başlat" — kayıt hemen başlamaz, önce etiket + süre modal'ı açılır. */
  function openStartModal(source: VcuRecordSource) {
    setStartTarget(source)
    setFormTags([])
    setFormSeconds(0)
  }

  /** Modal onayı: etiketleri öneri havuzuna kat ve kaydı başlat. */
  function confirmStart() {
    if (!startTarget || formTags.length === 0) return

    setKnownTags((prev: string[]) => {
      const merged = new Set<string>(prev)
      for (const tag of formTags) {
        const trimmed = tag.trim()
        if (trimmed) merged.add(trimmed)
      }
      if (merged.size === prev.length) return prev
      return Array.from(merged).sort((a, b) => a.localeCompare(b, "tr-TR"))
    })

    onStartRecording(startTarget.id, formTags, formSeconds)
    setStartTarget(null)
  }

  const formHours = Math.floor(formSeconds / 3600)
  const formMinutes = Math.floor((formSeconds % 3600) / 60)

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
      <VcuHeader
        page={page}
        subtitle={`(${sources.length} Kayıt Kaynağı)`}
        role={role}
        recordingCount={recordings.length}
        extra={
          <Button
            danger
            icon={<PoweroffOutlined />}
            disabled={recordings.length === 0}
            onClick={() => {
              modal.confirm({
                title: "Tüm kayıtlar durdurulsun mu?",
                content: `Süren ${recordings.length} kayıt durdurulup kütüphaneye eklenecek.`,
                okText: "Tümünü Durdur",
                cancelText: "Vazgeç",
                okButtonProps: { danger: true },
                onOk: onStopAllRecordings,
              })
            }}
          >
            Tüm Kayıtları Durdur
          </Button>
        }
      />

      {/* Filtre çubuğu — kütüphanedeki dille aynı: arama + tür sekmeleri,
          sağ uçta liste/kart anahtarı. */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 12px",
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Kaynak ara..."
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
          allowClear
          style={{ width: 240, flexShrink: 0 }}
        />

        <Segmented
          value={typeFilter}
          onChange={(value) => setTypeFilter(value as VcuRecordSourceType | "all")}
          options={[
            { label: `Tümü (${sources.length})`, value: "all" },
            ...RECORD_SOURCE_ORDER.map((type) => ({
              label: `${RECORD_SOURCE_META[type].label} (${typeCounts[type] ?? 0})`,
              value: type,
            })),
          ]}
        />

        <div style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <Text type="secondary" style={{ fontSize: 10 }}>
            {recordings.length > 0
              ? `${recordings.length} kayıt sürüyor`
              : `${filteredSources.length} kaynak`}
          </Text>

          <Segmented
            value={view}
            onChange={(value) => setView(value as VcuRecordView)}
            options={[
              { value: "list" satisfies VcuRecordView, icon: <UnorderedListOutlined /> },
              { value: "card" satisfies VcuRecordView, icon: <AppstoreOutlined /> },
            ]}
          />
        </div>
      </div>

      {filteredSources.length === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Kaynak bulunamadı.
          </Text>
        </div>
      ) : view === "list" ? (
        /* ── LİSTE: düz dikey kaydırma, sayfalama yok ── */
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {filteredSources.map((source) => (
            <VcuRecordRow
              key={source.id}
              source={source}
              recording={recordingBySourceId.get(source.id) ?? null}
              now={now}
              onStart={() => openStartModal(source)}
              onStop={() => onStopRecording(source.id)}
            />
          ))}
        </div>
      ) : (
        /* ── KART: yatay sayfalı şerit ── */
        <>
          {/* Yatay kaydırma scrollbar'ı gizler — Instagram hikâye şeridi hissi
              için; tabletin dokunmatik kaydırması bu stilden bağımsız çalışır. */}
          <style>{`
            .vcu-record-carousel::-webkit-scrollbar { display: none; }
          `}</style>
          <div
            ref={carouselRef}
            onScroll={handleCarouselScroll}
            className="vcu-record-carousel"
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              overflowX: "auto",
              overflowY: "hidden",
              scrollSnapType: "x mandatory",
              scrollbarWidth: "none",
            }}
          >
            {pages.map((pageSources, pageIndex) => (
              <div
                key={pageIndex}
                style={{
                  flex: "0 0 100%",
                  minWidth: "100%",
                  scrollSnapAlign: "start",
                  overflowY: "auto",
                  padding: 12,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: 10,
                  alignContent: "start",
                }}
              >
                {pageSources.map((source) => (
                  <VcuRecordCard
                    key={source.id}
                    source={source}
                    recording={recordingBySourceId.get(source.id) ?? null}
                    now={now}
                    onStart={() => openStartModal(source)}
                    onStop={() => onStopRecording(source.id)}
                  />
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Alt çubuk — sayfa noktaları (yalnızca kart görünümünde) ortada,
          tema seçici sağda. Diğer iki sayfada tema seçici
          VcuSelectionFooter'da; bu sayfanın öyle bir çubuğu olmadığı için
          burada kendi alt çubuğunu taşıyor. */}
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
        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {view === "card" &&
            pages.length > 1 &&
            pages.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Sayfa ${index + 1}`}
                onClick={() => scrollToPage(index)}
                style={{
                  width: index === currentPage ? 18 : 6,
                  height: 6,
                  borderRadius: 3,
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  background: index === currentPage ? token.colorPrimary : token.colorBorderSecondary,
                  transition: "width 150ms ease",
                }}
              />
            ))}
        </div>

        <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
          <VcuThemeSelect mode={mode} onModeChange={onModeChange} />
        </div>
      </footer>

      {/* ── BAŞLATMA MODAL'I — etiket + süre burada girilir ── */}
      <Modal
        open={startTarget !== null}
        title={startTarget ? `${startTarget.name} — kayıt başlat` : ""}
        okText="Kayıt Başlat"
        cancelText="Vazgeç"
        okButtonProps={{ danger: true, disabled: formTags.length === 0 }}
        onOk={confirmStart}
        onCancel={() => setStartTarget(null)}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Text type="secondary" style={{ fontSize: 11, fontWeight: 500 }}>
              Etiketler (en az 1)
            </Text>
            <Text type="secondary" style={{ fontSize: 10 }}>
              {formTags.length}/{MAX_RECORD_TAGS}
            </Text>
          </div>

          <Select
            mode="tags"
            value={formTags}
            autoFocus
            // maxCount antd tarafında da sınırlıyor; slice, sürüm farkına karşı
            // ikinci bir emniyet (yapıştırarak toplu giriş de kırpılsın diye).
            maxCount={MAX_RECORD_TAGS}
            onChange={(value: string[]) => setFormTags(value.slice(0, MAX_RECORD_TAGS))}
            placeholder={
              knownTags.length === 0
                ? `Etiket yazın (en fazla ${MAX_RECORD_TAGS})`
                : `Etiket seçin veya yazın (en fazla ${MAX_RECORD_TAGS})`
            }
            suffixIcon={<TagsOutlined />}
            style={{ width: "100%" }}
            maxTagCount="responsive"
            // Hazır öneri YOK: liste boş başlar, operatörün yazdıklarıyla dolar.
            options={knownTags.map((tag) => ({ label: tag, value: tag }))}
            notFoundContent={null}
          />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 10,
            }}
          >
            <Text type="secondary" style={{ fontSize: 11, fontWeight: 500 }}>
              Kayıt süresi
            </Text>
            <Text type="secondary" style={{ fontSize: 10 }}>
              {formSeconds > 0
                ? `${formatDuration(formSeconds)} sonra otomatik durur`
                : "Süresiz — elle durdurulur"}
            </Text>
          </div>

          {/* Saat + dakika. İkisi de 0 ise süre sınırı yoktur; kayıt yalnızca
              operatör durdurunca biter. Süre verilse bile "Durdur" her zaman
              açık — erken durdurmak serbest. */}
          <div style={{ display: "flex", gap: 6 }}>
            <Select
              value={formHours}
              onChange={(hours: number) => setFormSeconds(hours * 3600 + formMinutes * 60)}
              options={HOUR_OPTIONS}
              style={{ flex: 1 }}
            />
            <Select
              value={formMinutes}
              onChange={(minutes: number) => setFormSeconds(formHours * 3600 + minutes * 60)}
              options={MINUTE_OPTIONS}
              style={{ flex: 1 }}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
