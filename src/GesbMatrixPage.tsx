/**
 * ════════════════════════════════════════════════════════════════════
 *  GESB MATRİSİ SAYFASI
 *
 *  10.1" tablet görünümü: solda video kütüphanesi, sağda GESB büyük
 *  ekranlarının kart ızgarası. Bir GESB'e dokunup hedeflersiniz, soldan
 *  seçtiğiniz videolar eş zamanlı olarak o karta yüklenir.
 *
 *  KISIT 1: bir GESB ya CANLI ya KAYITLI içerik taşır — ikisi aynı kartta
 *  olamaz (bkz. VideoControlUnitPage'deki selectionKind kontrolü).
 *
 *  KISIT 2: KAYITLI içerik yalnızca TEKLİ gönderilir — dörtlü yok. Dörtlü
 *  düzen sadece CANLI kaynaklarda serbest (bkz. vcuShared/maxSelectableFor).
 * ════════════════════════════════════════════════════════════════════ */

import {
    CopyOutlined,
    PauseOutlined,
    PlayCircleFilled,
    PoweroffOutlined,
    SettingOutlined,
    WifiOutlined,
} from "@ant-design/icons"
import {
    App as AntApp,
    Badge,
    Button,
    Card,
    Tag,
    Tooltip,
    Typography,
    theme as antdTheme,
} from "antd"
import { useEffect, useState, type Dispatch, type SetStateAction } from "react"

import {
    MAX_SELECTABLE_VIDEOS,
    VcuHeader,
    VcuKindTag,
    VcuSelectionFooter,
    VcuSlotsPreview,
    VcuTransportBar,
    VcuVideoLibrary,
    defaultTransports,
    parseDuration,
    slotVideo,
    slotsKind,
    type VcuGesb,
    type VcuLayout,
    type VcuPageKey,
    type VcuRole,
    type VcuThemeMode,
    type VcuTransport,
    type VcuVideoKind,
    type VcuVideoSource,
} from "./vcuShared"

const { useToken } = antdTheme
const { Text } = Typography

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
  onTransportChange: (slotIndex: number, next: Partial<VcuTransport>) => void
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
  onTransportChange,
}: VcuGesbCardProps) {
  const { token } = useToken()
  const { modal } = AntApp.useApp()
  const isOffline = gesb.status === "offline"
  const isLive = gesb.status === "live"
  const isLoaded = gesb.status === "loaded"
  const hasContent = isLive || isLoaded
  const filledCount = gesb.slots.filter(Boolean).length
  const contentKind = slotsKind(gesb.slots, videosById)
  const isRecordedContent = contentKind === "recorded"

  /** Transport panelinin açık/kapalı hâli — varsayılan kapalı, kart uzamasın diye. */
  const [transportOpen, setTransportOpen] = useState(false)

  /**
   * Izgarada dokunulan videoya göre transport çubuğunun kontrol ettiği bölme.
   * Dolu ilk bölmeyle başlar; o bölme boşalırsa (kaldırılır/temizlenir) bir
   * sonraki dolu bölmeye düşer.
   */
  const filledIndices = gesb.slots
    .map((slot, i) => (slot ? i : null))
    .filter((i): i is number => i !== null)
  const [activeSlotIndex, setActiveSlotIndex] = useState(filledIndices[0] ?? 0)

  useEffect(() => {
    if (!filledIndices.includes(activeSlotIndex)) {
      setActiveSlotIndex(filledIndices[0] ?? 0)
    }
    // filledIndices her render'da yeni dizi — içeriğini stringe çevirip karşılaştırıyoruz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filledIndices.join(","), activeSlotIndex])

  const activeVideo = slotVideo(gesb.slots[activeSlotIndex] ?? null, videosById)
  const activeDuration = parseDuration(activeVideo?.duration)

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
                <CopyOutlined
                  style={{ fontSize: 16, color: copySource ? token.colorWarning : undefined }}
                />
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
      extra={
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {/* Sarma/hız panelini aç-kapat — varsayılan gizli, kart kompakt kalsın diye. */}
          {isRecordedContent && (
            <Tooltip title="Oynatma kontrollerini göster/gizle">
              <Button
                type="text"
                size="small"
                icon={<SettingOutlined style={{ color: transportOpen ? token.colorPrimary : undefined }} />}
                onClick={(event) => {
                  event.stopPropagation()
                  setTransportOpen((prev) => !prev)
                }}
                style={{ padding: "0 4px" }}
              />
            </Tooltip>
          )}
          <VcuKindTag kind={contentKind} />
          {modeTag}
        </div>
      }
    >
      <VcuSlotsPreview
        slots={gesb.slots}
        videosById={videosById}
        emptyActive={selected}
        emptyHint={selected ? "Video seçin, buraya yüklenecek" : "Hedeflemek için dokunun"}
        removeDisabled={isLive}
        onRemoveSlot={onRemoveSlot}
        activeSlotIndex={isRecordedContent ? activeSlotIndex : null}
        onSelectSlot={isRecordedContent ? setActiveSlotIndex : undefined}
      />

      {/* Sarma/hız yalnızca KAYITLI içerikte ve panel açıkken — canlı kaynağın
          zaman çizgisi yok, panel varsayılan kapalı (bkz. transportOpen). */}
      {isRecordedContent && transportOpen && (
        <VcuTransportBar
          transport={gesb.transports[activeSlotIndex]}
          duration={activeDuration}
          live={isLive}
          activeLabel={filledCount > 1 ? `#${activeSlotIndex + 1} · ${activeVideo?.name ?? ""}` : undefined}
          onChange={(next) => onTransportChange(activeSlotIndex, next)}
        />
      )}

      {/* Alt buton çubuğu — Yayınla/Başlat, Durdur, Temizle */}
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
              {isLive ? "Yayında" : isRecordedContent ? "Yayınla" : "Başlat"}
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
 *  SAYFA
 * ════════════════════════════════════════════════════════════════════ */

type GesbMatrixPageProps = {
  mode: VcuThemeMode
  onModeChange: (mode: VcuThemeMode) => void
  page: VcuPageKey
  onPageChange: (page: VcuPageKey) => void
  role: VcuRole
  recordingCount: number
  videos: VcuVideoSource[]
  videosById: Map<string, VcuVideoSource>
  gesbs: VcuGesb[]
  setGesbs: Dispatch<SetStateAction<VcuGesb[]>>
}

export function GesbMatrixPage({
  mode,
  onModeChange,
  page,
  onPageChange,
  role,
  recordingCount,
  videos,
  videosById,
  gesbs,
  setGesbs,
}: GesbMatrixPageProps) {
  const { token } = useToken()
  const { message, modal } = AntApp.useApp()

  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([])
  /** O an hedeflenen TEK GESB — aynı anda birden fazla GESB hedeflenemez. */
  const [selectedGesbId, setSelectedGesbId] = useState<string | null>(null)
  /** Kopya modunda "kaynak" olarak işaretlenen GESB. Dolu olduğunda bir sonraki
   *  GESB dokunuşu hedef seçmek yerine bu GESB'in içeriğini oraya yapıştırır. */
  const [copySourceId, setCopySourceId] = useState<string | null>(null)

  // Tekli/Dörtlü artık ayrı bir seçim değil — kaç video seçildiğinden
  // türetiliyor. Operatörün ayrıca mod seçmesine gerek yok. KAYITLI içerikte
  // seçim zaten tek videoyla sınırlı (bkz. toggleVideo), o yüzden burası
  // kayıtlıda daima "single" döner; dörtlü sadece canlıda oluşabilir.
  const layout: VcuLayout = selectedVideoIds.length > 1 ? "quad" : "single"

  /**
   * Seçimin türü (canlı / kayıtlı) — bir GESB'e ya canlı ya kayıtlı yüklenebilir,
   * ikisi aynı kartta olamaz. Seçim boşken null: her iki tür de serbest.
   */
  const selectionKind: VcuVideoKind | null =
    selectedVideoIds.length > 0 ? (videosById.get(selectedVideoIds[0])?.kind ?? null) : null

  const liveGesbCount = gesbs.filter((g) => g.status === "live").length

  /**
   * Oynayan zaman çizgilerini ilerletir — HER BÖLME BAĞIMSIZ (bkz. VcuGesb.transports).
   * "Oynuyor mu" ayrı bir alan değil: bir GESB `status === "live"` olduğu
   * sürece yüklü tüm bölmeleri oynatıyor sayılır. Mockup'ta konum istemcide
   * simüle ediliyor; gerçek entegrasyonda da benzeri gerekecek — GESB'in
   * anlık konumunu her saniye sormak yerine hızla ekstrapole edip periyodik
   * olarak GET /api/sessions ile düzelteceğiz (bkz. docs/VSU_BACKEND_API.md
   * soru 10-11).
   */
  const anyLive = gesbs.some((g) => g.status === "live")

  useEffect(() => {
    if (!anyLive) return

    const tick = 250
    const timer = window.setInterval(() => {
      setGesbs((prev) =>
        prev.map((g) => {
          if (g.status !== "live") return g
          const nextTransports = g.transports.map((t, i) => {
            const video = slotVideo(g.slots[i], videosById)
            if (!video) return t
            const duration = parseDuration(video.duration)
            const next = Math.min(duration, t.position + (tick / 1000) * t.rate)
            return next === t.position ? t : { ...t, position: next }
          })
          return { ...g, transports: nextTransports }
        }),
      )
    }, tick)
    return () => window.clearInterval(timer)
  }, [anyLive, setGesbs, videosById])

  function handleTransportChange(id: string, slotIndex: number, next: Partial<VcuTransport>) {
    setGesbs((prev) =>
      prev.map((g) =>
        g.id === id
          ? {
            ...g,
            transports: g.transports.map((t, i) => (i === slotIndex ? { ...t, ...next } : t)),
          }
          : g,
      ),
    )
  }

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
        g.id === targetId
          ? {
            ...g,
            layout: nextLayout,
            slots,
            status: "loaded" as const,
            // İçerik değişti: her bölmenin zaman çizgisi baştan başlar.
            transports: defaultTransports(),
          }
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
      const video = videosById.get(id)
      // Karışık yükleme yok: bir GESB ya canlı ya kayıtlı taşır.
      if (video && selectionKind && video.kind !== selectionKind) {
        void message.warning(
          selectionKind === "live"
            ? "Bu karta canlı kaynak yüklü — aynı kartta kayıtlı video olamaz. Önce seçimi temizleyin."
            : "Bu karta kayıtlı video yüklü — aynı kartta canlı kaynak olamaz. Önce seçimi temizleyin.",
        )
        return
      }
      if (video?.kind === "recorded") {
        // KAYITLI = TEKLİ. Dörtlü yalnızca canlı kaynaklarda anlamlı
        // (bkz. maxSelectableFor). Burada uyarı vermek yerine seçimi
        // DEĞİŞTİRİYORUZ: radyo düğmesi gibi, dokunulan kayıt seçili olur —
        // operatörün önce eskisini kaldırması gerekmesin.
        next = [id]
      } else {
        if (selectedVideoIds.length >= MAX_SELECTABLE_VIDEOS) {
          void message.warning(`En fazla ${MAX_SELECTABLE_VIDEOS} canlı kaynak seçebilirsiniz.`)
          return
        }
        next = [...selectedVideoIds, id]
      }
    }

    setSelectedVideoIds(next)
    if (selectedGesbId) pushSelectionToGesb(selectedGesbId, next)
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
            // Konum/hız da kopyalanır — hedef zaten canlı değilse otomatik oynamaya başlamaz.
            transports: source.transports.map((t) => ({ ...t })),
          }
          : g,
      ),
    )
    void message.success(
      `${source.name} içeriği ${gesbs.find((g) => g.id === targetId)?.name} GESB'ine kopyalandı.`,
    )
  }

  /**
   * "Yayınla": hazırlanan durum TEK atışta hedefe gider — kaynak listesi +
   * her bölmenin transport çubuğunda ayarlanan başlangıç konumu/hızı. Bu
   * andan sonra aynı çubuk canlı kontrole döner (her etkileşim hedefe anlık
   * bir istek).
   */
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
            transports: defaultTransports(),
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
            transports:
              remaining === 0
                ? defaultTransports()
                : g.transports.map((t, i) => (i === index ? { position: 0, rate: 1 } : t)),
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
      <VcuHeader
        page={page}
        onPageChange={onPageChange}
        mode={mode}
        onModeChange={onModeChange}
        subtitle={`(${gesbs.length} Ekran Matrisi)`}
        role={role}
        recordingCount={recordingCount}
        extra={
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
        }
      />

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <VcuVideoLibrary
          mode={mode}
          videos={videos}
          selectedVideoIds={selectedVideoIds}
          selectionKind={selectionKind}
          layout={layout}
          footerHint="Dokunarak seçin, hedeflediğiniz GESB'e otomatik yüklenir"
          onToggleVideo={toggleVideo}
        />

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
              (Kayıtlı: yalnızca tekli · Canlı: 1 kaynak tekli, 2-4 kaynak dörtlü)
            </Text>
            {copySourceId && (
              <Text type="warning" style={{ fontSize: 10, marginInlineStart: "auto" }}>
                Kopyalanacak: {gesbs.find((g) => g.id === copySourceId)?.name} — hedef GESB'e
                dokunun (iptal için kopya simgesine tekrar dokunun)
              </Text>
            )}
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
                selected={selectedGesbId === gesb.id}
                copySource={copySourceId === gesb.id}
                copyDisabled={gesb.slots.every((slot) => !slot)}
                onToggleSelect={() => handleGesbTap(gesb.id)}
                onCopy={() => handleCopyClick(gesb.id)}
                onStart={() => handleStart(gesb.id)}
                onStop={() => handleStop(gesb.id)}
                onClear={() => handleClear(gesb.id)}
                onRemoveSlot={(index) => handleRemoveSlot(gesb.id, index)}
                onTransportChange={(slotIndex, next) =>
                  handleTransportChange(gesb.id, slotIndex, next)
                }
              />
            ))}
          </div>
        </aside>
      </div>

      <VcuSelectionFooter
        selectedVideoIds={selectedVideoIds}
        videosById={videosById}
        selectionKind={selectionKind}
        layout={layout}
        statusText={
          selectedGesbId
            ? `Hedef: ${gesbs.find((g) => g.id === selectedGesbId)?.name}`
            : "Hedef GESB seçilmedi"
        }
        onRemoveSelected={toggleVideo}
      />
    </div>
  )
}
