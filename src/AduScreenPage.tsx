/**
 * ════════════════════════════════════════════════════════════════════
 *  ADU SAYFASI — "Bu Ekran"
 *
 *  Operatörün KENDİ ekranı. GESB matrisinden farkı: hedefleme ve
 *  kopyalama adımı yok, tek bir hedef var; soldan seçilen video doğrudan
 *  bu ekrana yüklenir.
 *
 *  KISIT 1: bu ekran da ya CANLI ya KAYITLI içerik taşır — karışık olamaz.
 *
 *  KISIT 2: KAYITLI içerik yalnızca TEKLİ yüklenir — dörtlü yok. Dörtlü
 *  düzen sadece CANLI kaynaklarda serbest (bkz. vcuShared/maxSelectableFor).
 * ════════════════════════════════════════════════════════════════════ */

import { PauseOutlined, PlayCircleFilled, SettingOutlined } from "@ant-design/icons"
import { App as AntApp, Button, Tag, Tooltip, Typography, theme as antdTheme } from "antd"
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
  type VcuLayout,
  type VcuOwnScreen,
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
 *  "BU EKRAN" KARTI
 * ════════════════════════════════════════════════════════════════════ */

type VcuOwnScreenCardProps = {
  ownScreen: VcuOwnScreen
  videosById: Map<string, VcuVideoSource>
  onStart: () => void
  onStop: () => void
  onClear: () => void
  onRemoveSlot: (index: number) => void
  onTransportChange: (slotIndex: number, next: Partial<VcuTransport>) => void
}

function VcuOwnScreenCard({
  ownScreen,
  videosById,
  onStart,
  onStop,
  onClear,
  onRemoveSlot,
  onTransportChange,
}: VcuOwnScreenCardProps) {
  const { token } = useToken()
  const { modal } = AntApp.useApp()
  const isLive = ownScreen.status === "live"
  const filledCount = ownScreen.slots.filter(Boolean).length
  const contentKind = slotsKind(ownScreen.slots, videosById)
  const isRecordedContent = contentKind === "recorded"

  /** Transport panelinin açık/kapalı hâli — varsayılan kapalı, kart uzamasın diye. */
  const [transportOpen, setTransportOpen] = useState(false)

  /** Izgarada dokunulan videoya göre transport çubuğunun kontrol ettiği bölme. */
  const filledIndices = ownScreen.slots
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

  const activeVideo = slotVideo(ownScreen.slots[activeSlotIndex] ?? null, videosById)
  const activeDuration = parseDuration(activeVideo?.duration)

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
              background: isLive
                ? token.colorError
                : filledCount > 0
                  ? token.colorWarning
                  : token.colorTextQuaternary,
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <span>Bu Ekran</span>
          <Text type="secondary" style={{ fontWeight: 400, fontSize: 11 }}>
            (ADU — yalnızca kendi ekranın)
          </Text>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {/* Sarma/hız panelini aç-kapat — varsayılan gizli, kart kompakt kalsın diye. */}
          {isRecordedContent && (
            <Tooltip title="Oynatma kontrollerini göster/gizle">
              <Button
                type="text"
                size="small"
                icon={<SettingOutlined style={{ color: transportOpen ? token.colorPrimary : undefined }} />}
                onClick={() => setTransportOpen((prev) => !prev)}
                style={{ padding: "0 4px" }}
              />
            </Tooltip>
          )}
          <VcuKindTag kind={contentKind} />
          {modeTag}
        </div>
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
          activeSlotIndex={isRecordedContent ? activeSlotIndex : null}
          onSelectSlot={isRecordedContent ? setActiveSlotIndex : undefined}
        />

        {/* Sarma/hız yalnızca KAYITLI içerikte ve panel açıkken — canlı kaynağın
            zaman çizgisi yok, panel varsayılan kapalı (bkz. transportOpen).
            flexShrink:0 — önizleme flex:1 ile büyürken çubuk ezilmesin. */}
        {isRecordedContent && transportOpen && (
          <div style={{ flexShrink: 0 }}>
            <VcuTransportBar
              transport={ownScreen.transports[activeSlotIndex]}
              duration={activeDuration}
              live={isLive}
              activeLabel={
                filledCount > 1 ? `#${activeSlotIndex + 1} · ${activeVideo?.name ?? ""}` : undefined
              }
              onChange={(next) => onTransportChange(activeSlotIndex, next)}
            />
          </div>
        )}
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
            {isLive ? "Oynatılıyor" : isRecordedContent ? "Yayınla" : "Başlat"}
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

type AduScreenPageProps = {
  mode: VcuThemeMode
  onModeChange: (mode: VcuThemeMode) => void
  page: VcuPageKey
  onPageChange: (page: VcuPageKey) => void
  role: VcuRole
  recordingCount: number
  videos: VcuVideoSource[]
  videosById: Map<string, VcuVideoSource>
  ownScreen: VcuOwnScreen
  setOwnScreen: Dispatch<SetStateAction<VcuOwnScreen>>
}

export function AduScreenPage({
  mode,
  onModeChange,
  page,
  onPageChange,
  role,
  recordingCount,
  videos,
  videosById,
  ownScreen,
  setOwnScreen,
}: AduScreenPageProps) {
  const { token } = useToken()
  const { message } = AntApp.useApp()

  /** Sayfa açıldığında kütüphane, ekranda hâlihazırda yüklü olanı yansıtır. */
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>(() =>
    ownScreen.slots.filter((slot): slot is string => slot !== null),
  )

  // KAYITLI seçim tek videoyla sınırlı (bkz. toggleVideo), o yüzden burası
  // kayıtlıda daima "single" döner; dörtlü sadece canlıda oluşabilir.
  const layout: VcuLayout = selectedVideoIds.length > 1 ? "quad" : "single"

  const selectionKind: VcuVideoKind | null =
    selectedVideoIds.length > 0 ? (videosById.get(selectedVideoIds[0])?.kind ?? null) : null

  /**
   * Oynayan zaman çizgilerini ilerletir — HER BÖLME BAĞIMSIZ (bkz.
   * VcuOwnScreen.transports). "Oynuyor mu" ayrı bir alan değil: ekran
   * `status === "live"` olduğu sürece yüklü tüm bölmeler oynatılıyor sayılır.
   */
  const isLive = ownScreen.status === "live"

  useEffect(() => {
    if (!isLive) return

    const tick = 250
    const timer = window.setInterval(() => {
      setOwnScreen((prev) => {
        if (prev.status !== "live") return prev
        const nextTransports = prev.transports.map((t, i) => {
          const video = slotVideo(prev.slots[i], videosById)
          if (!video) return t
          const duration = parseDuration(video.duration)
          const next = Math.min(duration, t.position + (tick / 1000) * t.rate)
          return next === t.position ? t : { ...t, position: next }
        })
        return { ...prev, transports: nextTransports }
      })
    }, tick)
    return () => window.clearInterval(timer)
  }, [isLive, setOwnScreen, videosById])

  function handleTransportChange(slotIndex: number, next: Partial<VcuTransport>) {
    setOwnScreen((prev) => ({
      ...prev,
      transports: prev.transports.map((t, i) => (i === slotIndex ? { ...t, ...next } : t)),
    }))
  }

  /** ADU'da hedefleme adımı yok — "Bu Ekran" tek hedef, seçim doğrudan ona yüklenir. */
  function pushSelectionToOwnScreen(videoIds: string[]) {
    if (videoIds.length === 0) return

    const slots = [0, 1, 2, 3].map((i) => videoIds[i] ?? null)
    const nextLayout: VcuLayout = videoIds.length > 1 ? "quad" : "single"

    setOwnScreen((prev) => ({
      ...prev,
      layout: nextLayout,
      slots,
      status: "loaded",
      // İçerik değişti: her bölmenin zaman çizgisi baştan başlar.
      transports: defaultTransports(),
    }))
  }

  function toggleVideo(id: string) {
    const isSelected = selectedVideoIds.includes(id)

    let next: string[]
    if (isSelected) {
      next = selectedVideoIds.filter((v) => v !== id)
    } else {
      const video = videosById.get(id)
      // Karışık yükleme yok: ekran ya canlı ya kayıtlı taşır.
      if (video && selectionKind && video.kind !== selectionKind) {
        void message.warning(
          selectionKind === "live"
            ? "Bu ekranda canlı kaynak yüklü — aynı ekranda kayıtlı video olamaz. Önce seçimi temizleyin."
            : "Bu ekranda kayıtlı video yüklü — aynı ekranda canlı kaynak olamaz. Önce seçimi temizleyin.",
        )
        return
      }
      if (video?.kind === "recorded") {
        // KAYITLI = TEKLİ (bkz. maxSelectableFor). Uyarı vermek yerine seçimi
        // değiştiriyoruz: dokunulan kayıt seçili olur, eskisi düşer.
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
    pushSelectionToOwnScreen(next)
  }

  /** "Yayınla": hazırlanan konum + hız, kaynak listesiyle birlikte tek atışta gider. */
  function handleStart() {
    setOwnScreen((prev) => ({ ...prev, status: "live" }))
  }

  function handleStop() {
    setOwnScreen((prev) => ({ ...prev, status: "loaded" }))
  }

  function handleClear() {
    setOwnScreen({
      status: "idle",
      layout: "single",
      slots: [null, null, null, null],
      transports: defaultTransports(),
    })
    setSelectedVideoIds([])
  }

  function handleRemoveSlot(index: number) {
    const nextSlots = [...ownScreen.slots]
    nextSlots[index] = null
    const remaining = nextSlots.filter(Boolean).length

    setOwnScreen((prev) => ({
      ...prev,
      slots: nextSlots,
      layout: remaining > 1 ? ("quad" as const) : ("single" as const),
      status: remaining === 0 ? ("idle" as const) : prev.status,
      transports:
        remaining === 0
          ? defaultTransports()
          : prev.transports.map((t, i) => (i === index ? { position: 0, rate: 1 } : t)),
    }))
    setSelectedVideoIds(nextSlots.filter((slot): slot is string => slot !== null))
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
        subtitle="(ADU — Kendi Ekranın)"
        role={role}
        recordingCount={recordingCount}
      />

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <VcuVideoLibrary
          mode={mode}
          videos={videos}
          selectedVideoIds={selectedVideoIds}
          selectionKind={selectionKind}
          layout={layout}
          footerHint="Dokunarak seçin, bu ekranda oynayacak"
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
              Bu Ekran
            </Text>
            <Text type="secondary" style={{ fontSize: 10 }}>
              (Kayıtlı: yalnızca tekli · Canlı: 1 kaynak tekli, 2-4 kaynak dörtlü)
            </Text>
          </div>

          <div style={{ flex: 1, overflow: "hidden", padding: 16, display: "flex" }}>
            <VcuOwnScreenCard
              ownScreen={ownScreen}
              videosById={videosById}
              onStart={handleStart}
              onStop={handleStop}
              onClear={handleClear}
              onRemoveSlot={handleRemoveSlot}
              onTransportChange={handleTransportChange}
            />
          </div>
        </aside>
      </div>

      <VcuSelectionFooter
        selectedVideoIds={selectedVideoIds}
        videosById={videosById}
        selectionKind={selectionKind}
        layout={layout}
        statusText={
          ownScreen.status === "live"
            ? "Bu ekran: Oynatılıyor"
            : ownScreen.status === "loaded"
              ? "Bu ekran: Yüklü"
              : "Bu ekran: Boş"
        }
        onRemoveSelected={toggleVideo}
        mode={mode}
        onModeChange={onModeChange}
      />
    </div>
  )
}
