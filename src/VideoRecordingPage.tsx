/**
 * ════════════════════════════════════════════════════════════════════
 *  VİDEO KAYIT SAYFASI — kaynakların kaydını alma ekranı
 *
 *  Kayıt alınabilen TÜM kaynaklar tek bir kart ızgarasında listelenir:
 *  opcon konsolları, kameralar, sensörler, radarlar. Her kart kendi
 *  kaydını yönetir — kayıt başlat / kayıt durdur.
 *
 *  ETİKET KURALI: etiketler kayıt BAŞLARKEN girilir (en az 1, en fazla
 *  MAX_RECORD_TAGS). Kayıt dururken oluşan video, bu etiketlerle birlikte
 *  kütüphaneye düşer; "Kayıtlı" sekmesinde etikete göre aranıp filtrelenir.
 *  Hazır etiket önerisi YOK: kutu boş açılır, operatörün bu oturumda yazdığı
 *  etiketler biriktirilip sonraki kartlara öneri olarak sunulur (knownTags).
 *
 *  SÜRE KURALI: kayıt başlarken saat + dakika seçilebilir. Süre dolunca kayıt
 *  KENDİLİĞİNDEN durur ve kütüphaneye düşer; sayaç geri sayar. 0sa 0dk
 *  seçilirse süre sınırı yoktur, kayıt yalnızca elle durdurulur. Her iki
 *  durumda da operatör istediği an "Kayıt Durdur" diyebilir.
 * ════════════════════════════════════════════════════════════════════ */

import { PoweroffOutlined, SearchOutlined, TagsOutlined } from "@ant-design/icons"
import {
  App as AntApp,
  Button,
  Card,
  Input,
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

/* ════════════════════════════════════════════════════════════════════
 *  KAYNAK KARTI
 * ════════════════════════════════════════════════════════════════════ */

/** Süre seçicisindeki saat seçenekleri. */
const HOUR_OPTIONS = Array.from({ length: 13 }, (_, h) => ({ label: `${h} sa`, value: h }))

/** Süre seçicisindeki dakika seçenekleri — dakika hassasiyetinde tam liste. */
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, m) => ({ label: `${m} dk`, value: m }))

type VcuRecordCardProps = {
  source: VcuRecordSource
  /** Bu kaynakta süren kayıt — yoksa kart "hazır" durumdadır. */
  recording: VcuRecording | null
  /** Kayıt başlamadan önce girilen etiketler (kart yerel taslağı). */
  draftTags: string[]
  /** Kayıt başlamadan önce seçilen süre, saniye. 0 → süresiz (elle durdurulur). */
  draftSeconds: number
  /**
   * Etiket kutusunun seçenekleri — hazır öneri listesi YOK, bunlar operatörün
   * bu oturumda yazdığı etiketler (bkz. sayfa düzeyindeki knownTags).
   */
  tagOptions: string[]
  /** Geçen süreyi yeniden hesaplatmak için saniyede bir güncellenen zaman damgası. */
  now: number
  onDraftTagsChange: (tags: string[]) => void
  onDraftSecondsChange: (seconds: number) => void
  onStart: () => void
  onStop: () => void
}

function VcuRecordCard({
  source,
  recording,
  draftTags,
  draftSeconds,
  tagOptions,
  now,
  onDraftTagsChange,
  onDraftSecondsChange,
  onStart,
  onStop,
}: VcuRecordCardProps) {
  const { token } = useToken()
  const meta = RECORD_SOURCE_META[source.type]
  const isRecording = recording !== null
  const isOffline = !source.online

  const elapsed = recording ? Math.floor((now - recording.startedAt) / 1000) : 0

  /** Süre sınırlı kayıtta kalan saniye; süresizde null. Sayaç bunu geri sayar. */
  const planned = recording?.plannedSeconds ?? 0
  const remaining = planned > 0 ? Math.max(0, planned - elapsed) : null

  const draftHours = Math.floor(draftSeconds / 3600)
  const draftMinutes = Math.floor((draftSeconds % 3600) / 60)

  const statusTag = isOffline ? (
    <Tag color="default">Bağlı değil</Tag>
  ) : isRecording ? (
    <Tag color="error">● Kayıtta</Tag>
  ) : (
    <Tag color="success">Hazır</Tag>
  )

  return (
    <Card
      size="small"
      style={{
        opacity: isOffline ? 0.6 : 1,
        borderColor: isRecording ? token.colorError : undefined,
        background: isRecording ? token.colorErrorBg : undefined,
      }}
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span
            className={isRecording ? "vcu-live-dot" : undefined}
            style={{
              width: 8,
              height: 8,
              flexShrink: 0,
              borderRadius: 999,
              background: isRecording
                ? token.colorError
                : isOffline
                  ? token.colorTextQuaternary
                  : token.colorSuccess,
              display: "inline-block",
            }}
          />
          <Text strong style={{ fontSize: 12, minWidth: 0 }} ellipsis>
            {source.name}
          </Text>
          <Text type="secondary" style={{ fontWeight: 400, fontSize: 11, flexShrink: 0 }}>
            ({source.location})
          </Text>
        </div>
      }
      extra={
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Tag icon={meta.icon} color={meta.color} style={{ marginInlineEnd: 0 }}>
            {meta.label}
          </Tag>
          {statusTag}
        </div>
      }
    >
      {isRecording ? (
        /* ── KAYIT SÜRÜYOR: sayaç + kaydın etiketleri (değiştirilemez) ── */
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Süre sınırı varsa sayaç GERİ SAYAR (kalan süre), yoksa geçen
              süreyi ileri sayar. Otomatik durdurma sayfa düzeyinde. */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 8,
              padding: "10px 12px",
              borderRadius: token.borderRadius,
              border: `1px solid ${token.colorErrorBorder}`,
              background: token.colorBgContainer,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <Text
                type="secondary"
                style={{ fontSize: 9, letterSpacing: 0.5, textTransform: "uppercase" }}
              >
                {remaining === null ? "Geçen süre" : "Kalan süre"}
              </Text>
              <Text
                style={{
                  fontFamily: "monospace",
                  fontSize: 22,
                  fontWeight: 600,
                  lineHeight: 1.1,
                  color: token.colorError,
                }}
              >
                {formatDuration(remaining ?? elapsed)}
              </Text>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 2,
                textAlign: "right",
              }}
            >
              <Text type="secondary" style={{ fontSize: 10 }}>
                Başlangıç: {dayjs(recording.startedAt).format("HH:mm:ss")}
              </Text>
              <Text type="secondary" style={{ fontSize: 10 }}>
                {remaining === null
                  ? "Süresiz — elle durdurun"
                  : `Geçen ${formatDuration(elapsed)} / ${formatDuration(planned)}`}
              </Text>
              {remaining !== null && (
                <Text style={{ fontSize: 10, color: token.colorError }}>
                  Bitince otomatik durur
                </Text>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4 }}>
            <TagsOutlined style={{ fontSize: 11, color: token.colorTextTertiary }} />
            {recording.tags.map((tag) => (
              <Tag key={tag} color="blue" style={{ marginInlineEnd: 0, fontSize: 10 }}>
                {tag}
              </Tag>
            ))}
          </div>
        </div>
      ) : (
        /* ── HAZIR: kayıt başlamadan önce etiketler girilir ── */
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Text type="secondary" style={{ fontSize: 11, fontWeight: 500 }}>
              Etiketler
            </Text>
            <Text type="secondary" style={{ fontSize: 10 }}>
              {draftTags.length}/{MAX_RECORD_TAGS}
            </Text>
          </div>

          <Select
            mode="tags"
            value={draftTags}
            disabled={isOffline}
            // maxCount antd tarafında da sınırlıyor; slice, sürüm farkına karşı
            // ikinci bir emniyet (yapıştırarak toplu giriş de kırpılsın diye).
            maxCount={MAX_RECORD_TAGS}
            onChange={(value: string[]) => onDraftTagsChange(value.slice(0, MAX_RECORD_TAGS))}
            placeholder={
              tagOptions.length === 0
                ? `Etiket yazın (en fazla ${MAX_RECORD_TAGS})`
                : `Etiket seçin veya yazın (en fazla ${MAX_RECORD_TAGS})`
            }
            suffixIcon={<TagsOutlined />}
            style={{ width: "100%" }}
            maxTagCount="responsive"
            // Hazır öneri YOK: liste boş başlar, operatörün yazdığı etiketlerle
            // dolar (bkz. sayfa düzeyindeki knownTags).
            options={tagOptions.map((tag) => ({ label: tag, value: tag }))}
            notFoundContent={null}
          />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 4,
            }}
          >
            <Text type="secondary" style={{ fontSize: 11, fontWeight: 500 }}>
              Kayıt süresi
            </Text>
            <Text type="secondary" style={{ fontSize: 10 }}>
              {draftSeconds > 0
                ? `${formatDuration(draftSeconds)} sonra otomatik durur`
                : "Süresiz — elle durdurulur"}
            </Text>
          </div>

          {/* Saat + dakika. İkisi de 0 ise süre sınırı yoktur; kayıt yalnızca
              operatör durdurunca biter. Süre verilse bile "Kayıt Durdur"
              her zaman açık — erken durdurmak serbest. */}
          <div style={{ display: "flex", gap: 6 }}>
            <Select
              value={draftHours}
              disabled={isOffline}
              onChange={(hours: number) => onDraftSecondsChange(hours * 3600 + draftMinutes * 60)}
              options={HOUR_OPTIONS}
              style={{ flex: 1 }}
            />
            <Select
              value={draftMinutes}
              disabled={isOffline}
              onChange={(minutes: number) => onDraftSecondsChange(draftHours * 3600 + minutes * 60)}
              options={MINUTE_OPTIONS}
              style={{ flex: 1 }}
            />
          </div>
        </div>
      )}

      {/* Alt buton çubuğu — Kayıt Başlat / Kayıt Durdur */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginTop: 10,
          paddingTop: 8,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        {isRecording ? (
          <Button danger type="primary" icon={<PoweroffOutlined />} onClick={onStop}>
            Kayıt Durdur
          </Button>
        ) : (
          <Tooltip
            title={
              isOffline
                ? "Kaynak bağlı değil"
                : draftTags.length === 0
                  ? "Kayıt başlatmadan önce en az bir etiket ekleyin"
                  : ""
            }
          >
            {/* disabled butonda Tooltip tetiklenmediği için sarmalayıcı span */}
            <span>
              <Button
                icon={<span style={{ fontSize: 11 }}>●</span>}
                disabled={isOffline || draftTags.length === 0}
                style={
                  isOffline || draftTags.length === 0
                    ? undefined
                    : { background: token.colorError, borderColor: token.colorError, color: "#fff" }
                }
                onClick={onStart}
              >
                Kayıt Başlat
              </Button>
            </span>
          </Tooltip>
        )}

        <Text type="secondary" style={{ fontSize: 10, textAlign: "right" }}>
          {isRecording ? "Durdurunca kütüphaneye düşer" : "Etiketler kayıtla birlikte saklanır"}
        </Text>
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
 *  30+ kaynak olduğunda tek dikey liste yerine bunu seçtik: operatör kaç
 *  kaynak olduğunu (nokta sayısından) görür, sayfalar arası gezinmek tek bir
 *  yatay kaydırma — dikey scroll + arama kombinasyonundan daha hızlı.
 * ════════════════════════════════════════════════════════════════════ */

/** Bir sayfada gösterilen kart sayısı (2 satır × 3 sütun varsayımıyla). */
const RECORD_PAGE_SIZE = 6

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
  onPageChange: (page: VcuPageKey) => void
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
  onPageChange,
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
  /** Kaynak başına, kayıt başlamadan önce girilen etiket taslağı. */
  const [draftTags, setDraftTags] = useState<Record<string, string[]>>({})
  /** Kaynak başına, kayıt başlamadan önce seçilen süre (saniye). 0 → süresiz. */
  const [draftSeconds, setDraftSeconds] = useState<Record<string, number>>({})
  /**
   * Etiket kutusunun seçenekleri. Hazır öneri listesi BİLEREK YOK — burası boş
   * başlar ve operatör etiket yazdıkça dolar, böylece aynı etiketi ikinci kez
   * yazmak yerine listeden seçebilir. Oturum boyunca yaşar (mockup); gerçek
   * entegrasyonda kütüphanedeki mevcut etiketlerden beslenecek.
   */
  const [knownTags, setKnownTags] = useState<string[]>([])
  /** Sayaçları saniyede bir ilerleten zaman damgası. */
  const [now, setNow] = useState(() => Date.now())

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

  // Filtre değişince (arama/tür) sayfa sayısı da değişir — en başa dön, yoksa
  // "3. sayfadaydım" durumu artık var olmayan bir sayfayı gösterebilir.
  useEffect(() => {
    setCurrentPage(0)
    carouselRef.current?.scrollTo({ left: 0 })
  }, [search, typeFilter])

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

  /**
   * Etiket taslağını günceller ve yazılan etiketleri öneri havuzuna katar.
   * Havuz boş başlar (hazır öneri yok) — operatör ne yazarsa o birikir.
   */
  function handleDraftTagsChange(sourceId: string, tags: string[]) {
    setDraftTags((prev) => ({ ...prev, [sourceId]: tags }))
    setKnownTags((prev: string[]) => {
      const merged = new Set<string>(prev)
      for (const tag of tags) {
        const trimmed = tag.trim()
        if (trimmed) merged.add(trimmed)
      }
      if (merged.size === prev.length) return prev
      return Array.from(merged).sort((a, b) => a.localeCompare(b, "tr-TR"))
    })
  }

  function handleStart(sourceId: string) {
    const tags = draftTags[sourceId] ?? []
    if (tags.length === 0) return
    onStartRecording(sourceId, tags, draftSeconds[sourceId] ?? 0)
    // Taslağı temizle: kayıt durunca kart yeni bir kayıt için boş açılsın.
    setDraftTags((prev) => ({ ...prev, [sourceId]: [] }))
    setDraftSeconds((prev) => ({ ...prev, [sourceId]: 0 }))
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
      <VcuHeader
        page={page}
        onPageChange={onPageChange}
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

      {/* Filtre çubuğu — kütüphanedeki dille aynı: arama + tür sekmeleri */}
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
          style={{ width: 260, flexShrink: 0 }}
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

        <Text type="secondary" style={{ fontSize: 10, marginInlineStart: "auto" }}>
          {recordings.length > 0
            ? `${recordings.length} kayıt sürüyor — durdurulunca kütüphaneye düşer`
            : pages.length > 1
              ? `Sayfa ${currentPage + 1}/${pages.length} — yana kaydırın`
              : "Etiket ekleyip kayıt başlatın"}
        </Text>
      </div>

      {filteredSources.length === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Kaynak bulunamadı.
          </Text>
        </div>
      ) : (
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
                  gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
                  gap: 12,
                  alignContent: "start",
                }}
              >
                {pageSources.map((source) => (
                  <VcuRecordCard
                    key={source.id}
                    source={source}
                    recording={recordingBySourceId.get(source.id) ?? null}
                    draftTags={draftTags[source.id] ?? []}
                    draftSeconds={draftSeconds[source.id] ?? 0}
                    tagOptions={knownTags}
                    now={now}
                    onDraftTagsChange={(tags) => handleDraftTagsChange(source.id, tags)}
                    onDraftSecondsChange={(seconds) =>
                      setDraftSeconds((prev) => ({ ...prev, [source.id]: seconds }))
                    }
                    onStart={() => handleStart(source.id)}
                    onStop={() => onStopRecording(source.id)}
                  />
                ))}
              </div>
            ))}
          </div>

        </>
      )}

      {/* Alt çubuk — sayfa noktaları ortada, tema seçici sağda. Diğer iki
          sayfada tema seçici VcuSelectionFooter'da; bu sayfanın öyle bir
          çubuğu olmadığı için burada kendi alt çubuğunu taşıyor. */}
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

        {/* Sayfa göstergesi — Instagram hikâye noktaları gibi; dokununca o sayfaya kayar. */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {pages.length > 1 &&
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
    </div>
  )
}
