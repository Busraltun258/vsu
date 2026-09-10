# rei-ui

REI'nin arayüz monorepo'su. npm workspaces + Turborepo ile yönetilen 4 paket:

| Paket | Yol | Ne | 
|---|---|---|
| `@rei/app` | `apps/rei` | Ana proje (REI) — login, draw/shape sistemi, Redux store, vs. |
| `@rei/ida` | `apps/ida` | IDA — REI'nin altında ama **bağımsız çalışabilen** ayrı bir uygulama (harita, NADIX, NAUTIS, FLIR, USV Mission Control, kendi auth context'i) |
| `@rei/vsu` | `apps/vsu` | VCU (Video Kontrol Ünitesi) — **bağımsız çalışan**, tek sayfalık video kontrol arayüzü tasarımı. Backend'e bağlı değil, tamamen sahte veriyle çalışır. Bkz. "VSU" bölümü. |
| `@rei/shared` | `packages/shared` | Diğerlerinin kullandığı, hiçbirine bağımlı olmayan ortak kütüphane |

Kurulumun/mimarinin daha derin geçmişi ve gerekçesi için: [docs/MONOREPO_PACKAGE_STRUCTURE.md](docs/MONOREPO_PACKAGE_STRUCTURE.md).

## Kurulum

```
npm install
```

(Root'ta bir kere yeterli — npm workspaces tüm `apps/*` ve `packages/*` paketlerini kurar.)

## Çalıştırma

```
npm run dev        # apps/rei     -> http://localhost:3002
npm run dev:ida    # apps/ida     -> http://localhost:5174
npm run dev:vsu    # apps/vsu     -> http://localhost:5175
```

Üçü ayrı dev server, ayrı portta çalışır — aynı anda görmek istersen üç terminal aç.
Production'da da üç bağımsız uygulamadır: ayrı RPM, ayrı port, **farklı origin** (IDA 8001,
REI 8002, VSU 8003 — bkz. "RPM paketleme"). IDA'nın kendi bağımsız login ekranı ve kendi
session'ı var (`@rei/shared/auth/idaSessionStorage.ts`, `localStorage`'da ayrı bir
`ida:session` anahtarı) — REI ile aynı anda kullanılmayacağı için (operasyonel kural)
aralarında oturum paylaşımına gerek yok. VSU'nun login'i yok, backend'e bağlı değil (bkz.
"VSU" bölümü).

## Build / lint / typecheck / test

Hepsi Turborepo üzerinden, workspace'lerin bağımlılık grafiğine göre otomatik sıralanır ve
cache'lenir:

```
npm run build       # apps/rei + apps/ida (packages/shared'ın build script'i yok, atlanır)
npm run build:rei   # sadece apps/rei
npm run build:ida   # sadece apps/ida
npm run lint        # 3 paket
npm run typecheck   # 3 paket
npm run test        # 3 paket (packages/shared'ınki vitest, saf mantık fonksiyonlarını kapsar)
```

Build çıktısı her paketin kendi altına düşer: **`apps/rei/dist/`** ve **`apps/ida/dist/`**
(Cesium statikleri `dist/cesiumStatic/` içine kopyalanır). Statik sunucuya/nginx'e koyacağın
klasör budur.

> **RPM alacaksan `npm run build` yetmez** — IDA'nın bridge bağımlılığını (`bridge-deps/`)
> üretmez ve gpack o klasörü aradığı için paketleme patlar. Bkz. "RPM paketleme".

`turbo.json`'daki `dependsOn: ["^build"]` gibi alanlar, bir paketin build'inin ona bağımlı
olan paketlerden **önce** çalışmasını garanti eder. Yeni bir workspace script'i eklersen
(`build`/`lint`/`typecheck`/`test` dışında bir şey) `turbo.json`'a task olarak eklemen gerekir,
yoksa `turbo run X` o script'i görmez.

`package.json`'daki `"packageManager": "npm@10.9.2"` alanını silme — Turbo, workspace'leri
hangi paket yöneticisinin (npm/yarn/pnpm) yönettiğini buradan tespit ediyor; yoksa
`could not resolve workspace` hatası alırsın.

## RPM paketleme

İki uygulama iki ayrı RPM olarak paketlenir. Süreç **iki aşamalıdır**: önce `make` ile RPM'e
girecek dosyalar hazırlanır, sonra `gpackrpm.py` paketi üretir. `make` tek başına RPM üretmez.

Ön koşullar: `make`, `node`/`npm` (sürüm için kök `package.json` → `packageManager`),
`python3.12` ve `/usr/bin/gpackrpm.py`. Bütün komutlar **repo kökünden** çalıştırılır.

### 1. Derleme

```
make ida     # apps/ida -> clean + npm ci + test + build   (ida-ui paketi)
make rei     # apps/rei -> clean + npm ci + test + build   (rei-ui paketi)
make vsu     # apps/vsu -> clean + npm ci + test + build   (vsu-ui paketi)
make all     # üçü birden
make ida-build / make rei-test / make vsu-clean ...        # tek adım
```

Her uygulamanın kendi `Makefile`'ı (`apps/<app>/Makefile`) var; kök `Makefile` sadece onlara
delege eder (`make <app>-<hedef>` deseniyle tek hedef de çalıştırılabilir). Adımlar:

| adım | ne yapar |
|---|---|
| `clean` | `dist/` siler (IDA'da ayrıca `bridge-deps/`) — `node_modules` **silinmez**, o kökte ve paylaşımlı |
| `compile` | **kökte** `npm ci` — bu yüzden `package-lock.json` commit'li olmalı |
| `test` | vitest; IDA ve REI'de başında `-` olduğu için başarısız olsa da build'i durdurmaz, **VSU'da durdurur** |
| `build` | IDA'da önce `bridge-deps`, sonra `vite build` → `dist/` |

`make all` üç uygulamayı da sürerken `npm ci`'ı üç kez çalıştırır (yavaş). Zaman önemliyse
kökte bir kere `npm ci` atıp `make ida-build && make rei-build && make vsu-build` de.

### 2. Paketleme

```
python3.12 /usr/bin/gpackrpm.py --xml_file deploy/gpack-ida.xml \
  --project ida --platform lbts --version 1.0.0 --csci_name rei-ui

python3.12 /usr/bin/gpackrpm.py --xml_file deploy/gpack-rei.xml \
  --project rei --platform lbts --version 1.0.0 --csci_name rei-ui

python3.12 /usr/bin/gpackrpm.py --xml_file deploy/gpack-vsu.xml \
  --project vsu --platform lbts --version 1.0.0 --csci_name rei-ui
```

gpack `<source>` yollarını **XML'in klasörünün bir üstüne**, yani repo köküne göre çözer
(hata mesajlarında `./deploy/../` olarak görünür). Bu yüzden `deploy/gpack-*.xml` içindeki
tüm kaynak yolları `apps/ida/...` / `apps/rei/...` şeklinde yazılmalı — gpack XML'lerini
uygulama klasörlerinin içine taşırsan bu yollar bozulur.

### Pakete ne giriyor

| | `ida-ui` | `rei-ui` | `vsu-ui` |
|---|---|---|---|
| `dist/` (Vite çıktısı) | ✅ | ✅ | ✅ |
| `nginx.conf` | ✅ | ✅ | ✅ |
| `.env` (→ `etc/config.env`) | ✅ | ✅ | — |
| `scripts/` + runtime `node_modules` (`ws`) | ✅ (`bridge-deps`) | — | — |
| `bin/start.sh`, `bin/stop.sh`, `systemd/*.service` | ✅ | — | — |

REI ve VSU tamamen statik dosyadan ibaret; yalnızca IDA (UDP bridge) ek olarak bir systemd
servisi taşır. Tam eşleşme için `deploy/gpack-ida.xml` / `deploy/gpack-rei.xml` /
`deploy/gpack-vsu.xml`.

### Hedef makinede nasıl çalışır

| | modül | port | kurulum yolu | systemd |
|---|---|---|---|---|
| IDA | `ida-ui` | 8001 | `/opt/havelsan/app/module/ida-ui` | `ida-ui.service` (sadece UDP bridge) |
| REI | `rei-ui` | 8002 | `/opt/havelsan/app/module/rei-ui` | yok |
| VSU | `vsu-ui` | 8003 | `/opt/havelsan/app/module/vsu-ui` | yok |

Statik dosyaları **sistem nginx'i** servis eder; her RPM sadece kendi server bloğunu
`/etc/nginx/conf.d/<modül>.conf` olarak kurar ve postinstall'da `nginx -t && systemctl reload
nginx` çalıştırır. Bu yüzden paketlerden biri kurulurken/kaldırılırken diğerleri kesintiye
uğramaz — ama portlar (8001/8002/8003) çakışmamalı.

`deploy/postinstall-<app>.sh` sırasıyla: `nginx.conf`'u `conf.d`'ye symlink'ler, nginx'i reload
eder; IDA'da ayrıca systemd unit'ini `/etc/systemd/system`'e symlink'ler ve servisi `enable` +
`restart` eder. Symlink kullanılmasının sebebi preuninstall'ın bunları `-L` kontrolüyle geri
alabilmesi.

IDA ek olarak `scripts/udp-ws-bridge.cjs`'i bir systemd servisi olarak çalıştırır (UDP 6002/6001
↔ WS 6003). Hedef makinede `npm install` yapılmadığı için bridge'in tek runtime bağımlılığı olan
`ws` paketi, `make ida-bridge-deps` ile **`apps/ida/bridge-deps/node_modules`**'e kopyalanır ve
RPM'e `<modül>/node_modules` olarak gömülür (`make ida` / `make ida-build` bunu zaten yapar).
`bridge-deps/` bir build çıktısıdır — kaynak değil, commit'lenmez, `make ida-clean` siler.

VSU'nun arka planda çalışan hiçbir süreci yok — üç sayfası da (`src/mockup/`) tamamen
istemci tarafında, sahte veriyle çalışır; backend'e bağlanmıyor. RPM'i yalnızca `dist/` + statik
`nginx.conf`'tan ibaret, REI ile birebir aynı desende.

### rollup / WASM override

Kök `package.json`'daki `overrides` bloğu `rollup`'ı `@rollup/wasm-node` ile değiştirir. Sebebi:
rollup'ın native binary'si `GLIBC_2.29` istiyor, build makinesinde (RHEL 8, glibc 2.28) yüklenemiyor.
Bu durumda rollup **yanıltıcı** bir hata basar:

```
Cannot find module @rollup/rollup-linux-x64-gnu.
npm has a bug related to optional dependencies...
```

Mesaj npm'i suçlasa da paket kuruludur; rollup native modül yüklerken oluşan her hatayı bu metinle
sarmalıyor. Gerçek sebebi görmek için: `node -e "require('@rollup/rollup-linux-x64-gnu')"`.
WASM sürümü biraz daha yavaş derler ama sistem glibc'sine bağımlı değildir. Rollup/Vite sürümünü
yükseltirsen `overrides`'taki sürümü de aynı hizaya çek.

## Bağımlılık yönü — İHLAL EDİLEMEZ

```
apps/rei ──> @rei/shared <── apps/ida
                  ^
                  └────────── apps/vsu
apps/rei ──> @rei/ida (SADECE public export: import ... from '@rei/ida')
```

- `apps/rei` → `@rei/shared` : serbest.
- `apps/ida` → `@rei/shared` : serbest.
- `apps/vsu` → `@rei/shared` : serbest.
- `apps/rei` → `@rei/ida` : sadece paketin public API'sinden (`import { X } from '@rei/ida'`).
  İç dosyalarına derin import (`@rei/ida/src/...`) **yasak**.
- `apps/ida` → `apps/rei` : **tamamen yasak**. IDA, REI olmadan da ayakta durabilmeli.
- `apps/vsu` → `apps/rei` veya `apps/ida` : **tamamen yasak**. VSU ayrı cihazlara (tablet,
  operatör PC'si, gemi duvar ekranı) kurulur; ikisinden birine bağlanması onu tek başına
  dağıtılamaz hale getirir.
- `@rei/shared` → `apps/*` : **yasak**. Shared paket hiçbir zaman kendi tüketicilerinden
  birini tanımamalı, yoksa artık "shared" olmaktan çıkar.

Bu kurallar konvansiyon değil — her paketin `eslint.config.js`'indeki
`no-restricted-imports` kuralıyla **lint zamanında** enforce ediliyor
(`packages/shared/eslint.config.js`, `apps/ida/eslint.config.js`, `apps/rei/eslint.config.js`,
`apps/vsu/eslint.config.js`). Kuralı ihlal eden bir import yazarsan `npm run lint` kırmızı döner.

## VSU — Video Kontrol Ünitesi (`apps/vsu`)

**Üç sayfa, ortak kabuk, backend'e bağlı değil.** React Router yok; `entry.tsx` tek bir kabuğu
`#root`'a monte eder, kabuk üst sekmelerle sayfalar arasında geçer:

| Dosya | Sekme | Ne yapar |
| --- | --- | --- |
| [`VideoControlUnitPage.tsx`](apps/vsu/src/mockup/VideoControlUnitPage.tsx) | — | Kabuk: tema, aktif sayfa ve sayfalar arası yaşayan tüm state (kütüphane, GESB'ler, kendi ekran, süren kayıtlar) |
| [`GesbMatrixPage.tsx`](apps/vsu/src/mockup/GesbMatrixPage.tsx) | GESB Matrisi | Hedef GESB'e video yükleme (10.1" tablet görünümü) |
| [`AduScreenPage.tsx`](apps/vsu/src/mockup/AduScreenPage.tsx) | ADU Ekranım | Operatörün kendi ekranı — hedefleme/kopyalama yok |
| [`VideoRecordingPage.tsx`](apps/vsu/src/mockup/VideoRecordingPage.tsx) | Video Kayıt | Kaynakların (opcon/kamera/sensör/radar) kaydını alma |
| [`vcuShared.tsx`](apps/vsu/src/mockup/vcuShared.tsx) | — | Ortak tipler, sahte veri, tema, kütüphane paneli, slot önizleme, üst başlık |

`antd` / `@ant-design/icons` / `dayjs` dışında hiçbir dış referans yok. Kabuk kendi
`<ConfigProvider>`'ını taşıyor, bu yüzden global bir tema sağlayıcısı kurulmuyor.

Önceki sürümde CU (10.1" dokunmatik), SERVER (operatör konsolu), ADU (kendi ekranı) ve GESB duvar
ekranı olmak üzere dört ayrı rota/yüzey, aralarında bir WebSocket hub'ı üzerinden senkronize olan
paylaşımlı bir state vardı. Hub ve senkronizasyon kaldırıldı; kalan sayfalar o tasarımın
**CU + ADU** kısmını, gerçek bir backend/senkronizasyon katmanı olmadan yeniden üretiyor.

### Ne yapıyor

- **Sayfa sekmeleri** üst başlıkta; seçim `localStorage`'da (`vsu:vcu-mockup-page`) kalıcı. İlk
  açılışta seçim yoksa ekran genişliğine bakılır (>1250px → ADU, altı → GESB matrisi); sonrasında
  pencere yeniden boyutlanınca sayfa **değişmez**.
- **"Seç → dokun" ataması**: sol listeden bir videoya dokun (en fazla 4 seçilebilir), sonra hedef
  GESB'e dokun. Atama yayını otomatik **başlatmaz** — GESB önce HAZIR durur, BAŞLAT ayrı bir adım.
- **Ya canlı ya kayıtlı**: bir GESB (ve ADU ekranı) aynı anda tek tür içerik taşır. Seçim
  başladıktan sonra karşı türdeki satırlar listede soluklaşır, dokunulursa sebebi yazan bir uyarı
  çıkar. Kartın köşesinde içerik türü rozeti (Canlı / Kayıtlı) durur.
- **Transport çubuğu (sarma / hız)**: yalnızca **kayıtlı** içerik yüklü kartlarda görünür — canlı
  kaynağın zaman çizgisi yok. İki fazlı: yayına almadan önce **yerel önizleme** (sarma/hız VCU'da
  kalır, hedef ekrana hiçbir şey gitmez), "Yayınla" konumu + hızı kaynak listesiyle tek atışta
  gönderir, sonrasında aynı çubuk **canlı kontrole** döner. İstek modeli döngü değil, yerleşmiş
  her etkileşim tek istek: slider sürüklenirken hiçbir şey gitmez, parmak kalkınca bir kez
  (`onChangeComplete`). Dörtlü düzende tek master zaman çizgisi. Kayıtlı içerikte "Başlat"
  düğmesi "Yayınla" olur. Gerçek uçlara bağlanırken açık kalan sorular:
  `docs/VSU_BACKEND_API.md` 7-11.
- **GESB'den GESB'e Kopyala**: bir GESB'i kaynak işaretleyip başka birine dokunarak içeriğini
  aktarır.
- **Canlı yayın kilidi**: bir GESB `status === "live"` iken Temizle ve tekil kaldırma ("×")
  düğmeleri kapanır — durdurmadan canlı içeriği kazara koparmayı önlemek için.
- **Kütüphane filtreleri**: arama (ad + etiket), tür sekmesi (Tümü/Kayıtlı/Canlı), tarih aralığı.
  *Canlı* sekmesinde ayrıca **kamera / sensör / radar** alt filtresi; *Kayıtlı* sekmesinde
  **etikete göre** çoklu filtre. Her canlı satır kaynak türü rozetini taşır.
- **Video kayıt sayfası**: kayıt alınabilen tüm kaynaklar (opcon, kamera, sensör, radar) kart
  ızgarasında. Kayıt başlatmadan önce **en az 1, en fazla 4 etiket** girilir; kayıt sürerken
  geçen süre sayacı döner, durdurulunca oluşan video etiketleriyle birlikte kütüphaneye düşer ve
  "Kayıtlı" sekmesinde etiketten aranabilir.
- **Açık/koyu tema** düğmesi, seçim `localStorage`'da (`vsu:vcu-mockup-theme`) kalıcı.
- Kayıtlı videolar sırayla "Opcon 1", "Opcon 2"... adlandırılır ve bir etiket rozeti taşır.

Backend'e bağlı değil — tüm veri (`initialGesbs`, `initialRecordSources`, kayıtlı/canlı kaynak
listeleri) `vcuShared.tsx` içinde sabit tanımlı. Gerçek bir video matrix/switcher entegrasyonu geldiğinde "SAHTE VERİ"
bölümünün yerini bir API client'ı alması bekleniyor; şu an öyle bir katman yok. Gerçek backend'in
(`csvn-control-service`) sunduğu uçlar, VCU'nun ihtiyaç duyduğu her eylemle eşleşmesi ve
netleşmesi gereken noktalar için: **`docs/VSU_BACKEND_API.md`**.

### Çalıştırma

```
npm run dev:vsu        # -> http://localhost:5175
```

Tek Vite dev server yeterli, ayrıca çalıştırılacak bir hub/backend süreci yok.

### PWA iskeleti

`public/manifest.webmanifest` ve `public/sw.js` yerinde duruyor (kiosk kurulum niyeti hâlâ
geçerli: 10.1" tablet gibi bir cihazda tam ekran açılması). Chrome "Uygulama olarak yükle"
seçeneğini yalnızca **güvenli origin**'de gösterir (HTTPS veya `localhost`/`127.0.0.1`); düz
`http://<ip>:8003` üzerinden açıldığında bu seçenek çıkmaz ve service worker kaydolmaz — kod hata
vermez, kayıt sessizce başarısız olur (`entry.tsx` sonundaki `.catch`). Sayfanın kendisi düz
HTTP'de sorunsuz çalışır; PWA tamamen üstüne eklenmiş bir katman. HTTPS geldiğinde ikisi de
kendiliğinden devreye girer.

## Yeni bir feature geliştirirken dikkat edilmesi gerekenler

1. **Önce sor: bu özellik gerçekten hem rei hem ida'da mı kullanılacak?**
   - Hayır, sadece rei'ye özelse (login, draw/shape sistemi gibi) →
     `apps/rei/src/` içinde kalsın, `@rei/shared`'a taşıma.
   - Evet, ikisinde de kullanılacaksa → `packages/shared/src/<özellik>/` altına yaz.

2. **Shared'a bir şey eklerken Redux'a/websocket'e "bağımlı görünüyor" diye vazgeçme —
   önce gerçekten neye bağımlı olduğuna bak.** Çoğu zaman tek bağımlılık bir `userId` string'i
   ya da bir-iki callback oluyor; bunları parametre/prop/callback'e çevirip veri katmanının
   tamamını `@rei/shared`'a taşıyabilirsin (örnek: `useUSVControl`, `useNautisRelayControl`,
   `useNadix` — bkz. `docs/MONOREPO_PACKAGE_STRUCTURE.md` bölüm 5).

3. **`useTheme()` (Redux'a bağlı) kullanıyorsa** → shared component'te `usePanelTheme()`
   context'ine çevir (`PanelThemeProvider` ile besleniyor). `apps/rei` Redux'tan okuyup
   context'e besler, `apps/ida` sabit/varsayılan tema kullanır.

4. **Yeni shared dosyayı `packages/shared/src/index.ts`'e eklemeyi unutma** — barrel'a
   girmeyen hiçbir şey `@rei/shared` üzerinden dışarı açılmaz.

5. **`packages/shared`'a saf mantık/util fonksiyonu ekliyorsan yanına test de yaz**
   (`packages/shared/src/<özellik>/__tests__/*.test.ts`, vitest). UI-ağırlıklı component'ler,
   hook'lar, context provider'lar ve socket-wiring dosyaları için ayrı test şart değil — onlar
   zaten `apps/rei`/`apps/ida`'nın kendi entegrasyon testleriyle dolaylı kapsanıyor. Cesium/canvas
   render'a dayanan kod (`map/cesiumHelpers.ts`, `track/CesiumCustomMarker.ts` gibi) da bu
   ortamda test edilmedi, jsdom'da canvas polyfill'i yok.

6. **`apps/ida`'da `apps/rei`'den hiçbir şey import edemezsin** (eslint engeller). Ortak bir
   şeye ihtiyacın varsa `@rei/shared`'a taşı.

7. **tsconfig/eslint'te ortak ayarları kopyalama.** Root'taki `tsconfig.base.json` ve
   `eslint.base.js` üç paket için de ortak; sadece paket-özel farklar (layering kuralları,
   react plugin'leri, `apps/rei`'nin ekstra strict tsconfig flag'leri) kendi dosyasında kalmalı.

8. **Yeni bir workspace script'i eklediysen `turbo.json`'a da ekle** (bkz. yukarıdaki
   Build bölümü) — yoksa `npm run <script>` root'tan çalıştırıldığında o paketi atlar.
