# my board 🪷

Trello-yə bənzəyən şəxsi board app-in. Burada bunlar var: daily board, Month görünüşü, 📸 Moment, theme və mood sistemi, motivation videoları, ☀️ "Halaldır sənə" səhəri, 🌙 şükür ritualı, streak və Siri.

Aşağıdakı addımlar sənin üçün yazılıb: **kompüter Windows, telefon iPhone**.

---

## 1. Kompüterdə launch (Windows, ~5 dəqiqə)

1. **Docker Desktop** quraşdır: docker.com → *Download for Windows*. Quraşdırma WSL2 istəsə, "OK" de və kompüteri restart et.
2. Docker Desktop-ı aç, Settings-də **"Start Docker Desktop when you sign in"** seçimini yandır.
3. `myboard.zip` faylını aç, məsələn `C:\Users\<sən>\myboard` qovluğuna.
4. Qovluqda boş yerə **Shift + sağ klik** et, **"Open in Terminal"** (PowerShell) seç və bunları işlət:
   ```powershell
   Copy-Item .env.example .env
   docker compose up --build -d
   ```
5. Browser-də **http://localhost:8000** ünvanını aç 🎉

- `-d` app-i arxa planda işlədir. App `restart: unless-stopped` ilə qurulub, ona görə kompüteri yenidən açanda özü başlayacaq.
- App-i dayandırmaq üçün `docker compose down`, yeniləmək üçün yeni zip-i eyni qovluğa aç və yenidən `docker compose up --build -d` işlət.
- Bütün data (DB, attachment-lar, videolar) Docker volume-unda saxlanılır. Rebuild və yeniləmə zamanı silinmir. Backup almaq üçün: `docker compose cp myboard:/data .\backup`
- ⚠️ `docker compose down -v` işlətmə, `-v` bayrağı bütün data-nı silir.

## 2. iPhone-da açmaq (Tailscale, ~5 dəqiqə, pulsuz)

Tailscale-in faydaları:
- Telefon kompüterdəki app-ə **hər yerdən** (evdən kənarda da) qoşula bilir.
- Push mesajı üçün lazım olan **HTTPS**-i avtomatik verir.
- App internetə açılmır, yalnız sənin cihazların görür.

1. **Windows-a** Tailscale quraşdır (tailscale.com/download) və login ol.
2. **iPhone-a** App Store-dan **Tailscale** quraşdır və eyni hesabla login ol, VPN-i yandır.
3. Kompüterdə PowerShell-də bunu işlət:
   ```powershell
   tailscale serve --bg 8000
   ```
   İlk dəfə HTTPS-i aktivləşdirmək üçün link verəcək. Onu aç, təsdiqlə və əmri yenidən işlət. Sonra `https://<kompüter-adı>.<...>.ts.net` kimi bir ünvan göstərəcək.
4. iPhone-da **Safari** ilə həmin `https://….ts.net` ünvanını aç, sonra **Share (□↑) → Add to Home Screen** seç.
5. Bundan sonra app-i həmişə **Home Screen-dəki ikondan** aç.

Telefonda drag etmək üçün card-a **basıb bir an saxla**, sonra sürüşdür.

## 3. ☀️ Səhər və 🌙 axşam mesajları (push)

iOS 16.4 və ya daha yeni versiya lazımdır. App **Home Screen-dən** açılmalıdır, 2-ci bölməyə bax.

1. Home Screen-dəki app-də **Settings → Morning & evening messages → Turn on for this device** düyməsinə bas və icazə ver.
2. **Test ☀️** və **Test 🌙** düymələri ilə yoxla.
3. Saatları burada seçə bilərsən (default: 08:00 və 21:30).

- ☀️ Səhər mesajı belə görünəcək: *"Halaldır sənə 💛 · Dünən 4 iş bitirdin · 🔥 6 gün ardıcıl"*, altında bir quote və pozitiv bir ♓ mesajı. Mesaja basanda Morning səhifəsi açılır: dünənki uğurların, öz cümlən və günün videosu.
- 🌙 Axşam mesajına basanda şükür ritualı açılır.

⚠️ **Windows yuxuya gedirsə, mesaj göndərilmir.** Mesajın səhər gəlməsi üçün:
- **Settings → System → Power & battery → Screen and sleep** bölməsində *"When plugged in, put my device to sleep after"* seçimini **Never** et. Ekran sönə bilər, bu problem deyil.
- Kompüter səhər gec oyanarsa, mesaj saat 11:00-a qədər yenə göndərilir.
- Növbəti addım: app-i AWS-də kiçik bir serverdə 24/7 işlətmək. Onda kompüterin açıq olmasına ehtiyac qalmayacaq.

## 4. 🗣 "Hey Siri, add task"

Bu, kilidli ekranda da işləyir, çünki Siri birbaşa sənin server-inə yazır. Ünvanı **Settings → "Hey Siri, add task"** bölməsindən kopyala, sonra iPhone-da **Shortcuts** app-də bunları et:

1. **+** düyməsinə bas, adını **Add task** qoy. Siri-yə deyəcəyin söz budur.
2. **Dictate Text** action-ı əlavə et. Language: English və ya Turkish. *Stop Listening*: After Pause.
3. **Get Contents of URL** action-ı əlavə et:
   - ünvanı yapışdır
   - **Method: POST**
   - **Request Body: JSON**
   - field əlavə et: `text` = *Dictated Text*
4. **Speak Text** action-ı əlavə et və *Contents of URL* seç.
5. Test et: **"Hey Siri, add task"** de, sonra "call dad at six". Siri cavab verəcək: *"Əlavə etdim: …"*, task da bu günün To Do sütununa düşəcək.

Shortcut-un işləməsi üçün telefonda Tailscale VPN açıq olmalıdır.

## 5. YouTube motivation videoları (optional)

Key olmadan da işləyir: əvvəlcə favourite-lərin, sonra öz vlog-ların göstərilir. Key əlavə etsən, app zövqünə uyğun yeni Shorts tapacaq.

1. **console.cloud.google.com** saytına gir → **New Project** → **APIs & Services → Library → YouTube Data API v3 → Enable**
2. **Credentials → Create Credentials → API key** seç, key-i **Restrict key → YouTube Data API v3** ilə məhdudlaşdır
3. Key-i `.env` faylına yaz (`notepad .env`): `YOUTUBE_API_KEY=...`
4. `docker compose up -d` ilə yenidən başlat

---

## Necə işləyir

| | |
|---|---|
| **Today** | Hər gün üçün avtomatik board yaranır (To Do / In Progress / Done). Dünəndən qalan bitməmiş card-lar bu günə özü keçir və üstündə **↻ tarix** görünür. |
| **Drag & drop** | Card-ları sütunlar arasında, sütunları isə header-indən tutub sürüşdür. Sıra avtomatik saxlanılır. |
| **Card** | Vaxt, label, notes və istənilən fayl əlavə etmək olur (hər fayl 200MB-a qədər). "Move to tomorrow" card-ı sabaha keçirir. |
| **📸 Moment** | Sağ aşağıdakı düymə ilə şəkil və ya qısa video çəkib "indi nə edirəm" yazırsan, saatı ilə birlikdə card kimi düşür. iPhone videoları avtomatik mp4-ə çevrilir. |
| **Month** | Hər günün progress-i, mood-u, ✨ ritual günləri və special day-lər görünür. |
| **Special days** | Month səhifəsindən əlavə olunur. 🔥 Motivation day və ya bütün ay üçün Motivation month seçimi də var. |
| **Mood və theme-lər** | Hər səhər mood seçirsən. Hər fəsil və mood-un öz çəkilmiş, animasiyalı səhnəsi var. |
| **🌅 Halaldır sənə** | Səhər dünənki **real** uğurların göstərilir: bitirdiyin işlər, moment-lər, "özüm haqqında" yazdığın bir cümlə. Ümumi tərifləri beyin qəbul etmir, öz sübutlarına isə inanır. |
| **🌙 Ritual** | Axşam bu gün şükür etdiyin 3 şeyi, özündə bəyəndiyin 1 şeyi və sabah üçün 1 əsas işi yazırsan. Sabahın işi avtomatik sabahın board-unda ən yuxarıda olur. Sonra şükür duan göstərilir. |
| **🔥 Streak** | Gün iki halda sayılır: işlərin yarısını bitirmisənsə, **və ya** axşam ritualını etmisənsə. Belə ki, ağır bir gündə də şükür yazsan, streak-in qırılmır. |
| **📔 Uğurlar dəftəri** | Yazdığın bütün yaxşı şeylər burada toplanır, çətin günlərdə oxumaq üçündür. "Özüm haqqında" cümlələrini və duanı da burada dəyişirsən. |

## Testlər

```powershell
cd backend; pip install -r requirements-dev.txt; pytest          # 35 API test
cd ..\frontend; npm install; npm run build; npx playwright install chromium; npx playwright test   # 22 E2E test
```
E2E testlər real browser-də bunları yoxlayır:
- drag & drop: mouse ilə və telefonda touch ilə
- moment-lər: iPhone HEVC videosu daxil
- mood, sonra video axını
- səhər "Halaldır sənə"
- axşam ritualı, streak, Uğurlar dəftəri
- Siri endpoint-i
- "broken image" və console error olmaması

## Docker olmadan (development, Windows)

```powershell
# backend (ffmpeg optional: winget install ffmpeg)
cd backend
python -m venv .venv; .venv\Scripts\activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
# frontend, ayrı terminalda → http://localhost:5173
cd frontend; npm install; npm run dev
```

## Struktur

```
backend/app/
  boards.py      board, sütun, card, attachment, carry-over
  days.py        calendar, special days, mood
  ritual.py      Halaldır sənə, şükür ritualı, streak, Uğurlar dəftəri, Siri
  push.py        səhər və axşam push mesajları (Web Push + scheduler)
  morning_messages.py  quote-lar və ♓ mesajları (yalnız pozitiv) — istədiyin kimi dəyiş
  motivation.py  mini "YouTube algorithm"
  video.py       iPhone videoları → mp4 + poster
  seed_media/videos/   sənin 3 study vlog-un (istəmirsənsə sil)
frontend/src/
  components/Board.tsx    drag & drop (dnd-kit)
  components/Scenes.tsx   theme səhnələri
  pages/RitualPage.tsx    Halaldır sənə, ritual, Uğurlar dəftəri
```
