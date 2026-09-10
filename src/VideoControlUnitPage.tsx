/**
 * ════════════════════════════════════════════════════════════════════
 *  VIDEO KONTROL ÜNİTESİ (VCU) — UYGULAMA KABUĞU
 *
 *  10.1" dokunmatik tablet üzerinden GESB'lere (büyük ekranlara) video
 *  dağıtımı yapan kiosk arayüzü. apps/vsu'nun giriş noktası budur.
 *
 *  ÜÇ SAYFA, her birinin kendi adresi var:
 *    · "/gesb"   GESB Matrisi  → GesbMatrixPage     (hedef GESB'e video yükleme)
 *    · "/adu"    ADU Ekranım   → AduScreenPage      (operatörün kendi ekranı)
 *    · "/kayit"  Video Kayıt   → VideoRecordingPage (kaynakların kaydını alma)
 *
 *  Kök adres ("/") bir sayfa DEĞİL, yönlendirmedir: cihazın rolüne göre
 *  tablette GESB'e, operatör bilgisayarında ADU'ya çözülür.
 *
 *  SEKME ÇUBUĞU YOK. Üçü de ayrı birer pencere: üst başlıktaki bağlantılar
 *  diğer sayfaları YENİ SEKMEDE açar, sayfa içi geçiş yapılmaz. Video kayıt
 *  bağlantısı yalnızca operatör bilgisayarında görünür — 10.1" tablette
 *  (kontrol ünitesi) kayıt alınmıyor.
 *
 *  Sayfalar arasında yaşaması gereken her şey (video kütüphanesi, GESB
 *  durumları, kendi ekran, süren kayıtlar) BURADA tutulur. DİKKAT: bu
 *  durum sekmeye özeldir — sayfalar ayrı sekmelerde açıldığı için biri
 *  diğerinin durumunu göremez. Mockup'ta kabul edilebilir; gerçek
 *  entegrasyonda ortak durum backend'den gelecek. Ortak tipler/tema/
 *  bileşenler vcuShared.tsx'te.
 *
 *  Backend'e bağlı değil — gerçek bir video matrix/kayıt entegrasyonu
 *  geldiğinde vcuShared'deki "SAHTE VERİ" bölümünün yerini bir API
 *  client'ı alır.
 * ════════════════════════════════════════════════════════════════════ */

import { App as AntApp, ConfigProvider } from "antd"
import dayjs from "dayjs"
import { useEffect, useMemo, useState } from "react"

import { AduScreenPage } from "./AduScreenPage"
import { GesbMatrixPage } from "./GesbMatrixPage"
import { VideoRecordingPage } from "./VideoRecordingPage"
import {
  THEME_STORAGE_KEY,
  defaultTransports,
  VCU_DARK_THEME,
  VCU_LIGHT_THEME,
  VcuGlobalStyles,
  formatDuration,
  initialGesbs,
  initialRecordSources,
  initialVideos,
  readStoredTheme,
  vcuPageFromLocation,
  vcuPageHref,
  type VcuGesb,
  type VcuOwnScreen,
  type VcuPageKey,
  type VcuRecording,
  type VcuRole,
  type VcuThemeMode,
  type VcuVideoSource,
} from "./vcuShared"

/** Bu genişlikten büyük ekranlar "normal bilgisayar" (operator) sayılır. */
const OPERATOR_BREAKPOINT = 1250

/**
 * Cihazın rolü. Genişlik SADECE ilk açılışta okunur; pencere yeniden
 * boyutlanınca rol değişmez (eski davranışta bu, beklenmedik anda görünüm
 * değiştiriyordu).
 *
 * GEÇİCİ: genişlikten rol tahmin etmek kalıcı çözüm değil. Cihazın kontrol
 * ünitesi mi (tablet) yoksa operatör bilgisayarı mı olduğu — ve ADU ise kendi
 * `displayUnit` adı — sunucudan gelmeli; bkz. docs/VSU_BACKEND_API.md soru 13.
 * O config geldiğinde buradaki tahmin kalkar, gerisi aynen çalışır.
 */
function readRole(): VcuRole {
  return window.innerWidth > OPERATOR_BREAKPOINT ? "operator" : "control-unit"
}

/**
 * Kök adreste ("/") hangi sayfa açılır. Kayıt ekranı buraya HİÇ düşmez —
 * ona yalnızca kendi adresinden gidilir, çünkü ayrı bir sekmede açılıyor.
 */
function defaultPageFor(role: VcuRole): VcuPageKey {
  return role === "operator" ? "adu" : "gesb"
}

/**
 * Açılış sayfası: adres çubuğu ne diyorsa o; kök adreste karar rolündür.
 * Sayfa seçimi artık localStorage'da DEĞİL adreste tutuluyor — kayıt ekranı
 * ancak gerçek bir adresi varsa ayrı sekmede açılabilir.
 */
function readInitialPage(role: VcuRole): VcuPageKey {
  return vcuPageFromLocation() ?? defaultPageFor(role)
}

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
        <VcuGlobalStyles />
        <VideoControlUnitShell mode={mode} onModeChange={setMode} />
      </AntApp>
    </ConfigProvider>
  )
}

function VideoControlUnitShell({
  mode,
  onModeChange,
}: {
  mode: VcuThemeMode
  onModeChange: (mode: VcuThemeMode) => void
}) {
  const { message } = AntApp.useApp()

  /** Cihaz rolü — ilk açılışta bir kez belirlenir, sonra değişmez. */
  const [role] = useState<VcuRole>(readRole)
  const [page, setPage] = useState<VcuPageKey>(() => readInitialPage(role))

  // SAYFA İÇİ GEZİNME YOK: üç sayfa da kendi adresinde ayrı bir pencere,
  // üst başlıktaki bağlantılar hepsini yeni sekmede açıyor (bkz. PAGE_LINKS).
  // Bu yüzden pushState eden bir navigate() da yok — sayfa açılışta adresten
  // bir kez okunuyor. popstate yine de dinleniyor ki adres dışarıdan
  // değişirse (geri/ileri) doğru ekran gösterilsin.
  useEffect(() => {
    // Kök adreste açıldıysak adres çubuğunu gerçekte gösterilen sayfaya
    // eşitle — böylece adres kopyalanıp aynı ekran tekrar açılabilir.
    if (window.location.pathname !== vcuPageHref(page)) {
      window.history.replaceState({ page }, "", vcuPageHref(page))
    }

    function handlePopState() {
      setPage(vcuPageFromLocation() ?? defaultPageFor(role))
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
    // Yalnızca ilk montajda kurulur; `page` bilerek bağımlılık değil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])

  /* ── Sayfalar arası yaşayan durum ──────────────────────────────── */

  /** Video kütüphanesi. Kayıt sayfasında biten her kayıt buraya eklenir. */
  const [videos, setVideos] = useState<VcuVideoSource[]>(initialVideos)
  const [gesbs, setGesbs] = useState<VcuGesb[]>(initialGesbs)
  const [ownScreen, setOwnScreen] = useState<VcuOwnScreen>({
    status: "idle",
    layout: "single",
    slots: [null, null, null, null],
    transports: defaultTransports(),
  })
  const [recordings, setRecordings] = useState<VcuRecording[]>([])

  const videosById = useMemo(
    () => new Map(videos.map((video) => [video.id, video])),
    [videos],
  )

  /* ── Kayıt işlemleri ───────────────────────────────────────────── */

  /** `plannedSeconds` 0 ise süresiz kayıt; doluysa süre dolunca kendiliğinden durur. */
  function handleStartRecording(sourceId: string, tags: string[], plannedSeconds: number) {
    const source = initialRecordSources.find((s) => s.id === sourceId)
    if (!source || !source.online) return
    if (recordings.some((recording) => recording.sourceId === sourceId)) return

    setRecordings((prev) => [
      ...prev,
      { sourceId, startedAt: Date.now(), tags, plannedSeconds },
    ])
    void message.success(
      plannedSeconds > 0
        ? `${source.name} kaydı başladı — ${formatDuration(plannedSeconds)} sonra otomatik duracak.`
        : `${source.name} kaydı başladı.`,
    )
  }

  /**
   * Kaydı bitirir ve oluşan videoyu kütüphaneye ekler — etiketleriyle
   * birlikte, ki "Kayıtlı" sekmesinde etikete göre bulunabilsin. Katalog
   * numarası (Opcon N) sıradan türetildiği için sona ekleniyor.
   */
  function handleStopRecording(sourceId: string) {
    const recording = recordings.find((item) => item.sourceId === sourceId)
    if (!recording) return
    const source = initialRecordSources.find((s) => s.id === sourceId)

    const seconds = Math.max(1, Math.round((Date.now() - recording.startedAt) / 1000))
    const newVideo: VcuVideoSource = {
      id: `rec-${sourceId}-${recording.startedAt}`,
      name: `${source?.name ?? "Kayıt"} · ${dayjs(recording.startedAt).format("DD.MM HH:mm")}`,
      kind: "recorded",
      duration: formatDuration(seconds),
      date: dayjs(recording.startedAt).format("YYYY-MM-DD"),
      tags: recording.tags,
    }

    setVideos((prev) => [...prev, newVideo])
    setRecordings((prev) => prev.filter((item) => item.sourceId !== sourceId))
    void message.success(`Kayıt tamamlandı (${newVideo.duration}) — kütüphaneye eklendi.`)
  }

  function handleStopAllRecordings() {
    if (recordings.length === 0) return
    const stoppedAt = Date.now()

    const newVideos = recordings.map((recording) => {
      const source = initialRecordSources.find((s) => s.id === recording.sourceId)
      const seconds = Math.max(1, Math.round((stoppedAt - recording.startedAt) / 1000))
      return {
        id: `rec-${recording.sourceId}-${recording.startedAt}`,
        name: `${source?.name ?? "Kayıt"} · ${dayjs(recording.startedAt).format("DD.MM HH:mm")}`,
        kind: "recorded" as const,
        duration: formatDuration(seconds),
        date: dayjs(recording.startedAt).format("YYYY-MM-DD"),
        tags: recording.tags,
      }
    })

    setVideos((prev) => [...prev, ...newVideos])
    setRecordings([])
    void message.success(`${newVideos.length} kayıt durduruldu ve kütüphaneye eklendi.`)
  }

  /* ── Sayfa seçimi ──────────────────────────────────────────────── */

  if (page === "record") {
    return (
      <VideoRecordingPage
        mode={mode}
        onModeChange={onModeChange}
        page={page}
        role={role}
        sources={initialRecordSources}
        recordings={recordings}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
        onStopAllRecordings={handleStopAllRecordings}
      />
    )
  }

  if (page === "adu") {
    return (
      <AduScreenPage
        mode={mode}
        onModeChange={onModeChange}
        page={page}
        role={role}
        recordingCount={recordings.length}
        videos={videos}
        videosById={videosById}
        ownScreen={ownScreen}
        setOwnScreen={setOwnScreen}
      />
    )
  }

  return (
    <GesbMatrixPage
      mode={mode}
      onModeChange={onModeChange}
      page={page}
      role={role}
      recordingCount={recordings.length}
      videos={videos}
      videosById={videosById}
      gesbs={gesbs}
      setGesbs={setGesbs}
    />
  )
}
