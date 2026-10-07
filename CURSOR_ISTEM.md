# Cursor istemi: Pencereler arası portal (v1)

Aşağıdaki metnin tamamını Cursor'un Agent moduna yapıştır.

---

Bu klasörde tarayıcıda çalışan küçük bir oyun/deney yap. Adı "Pencere Portalı". Sosyal medya videosu için çekilecek;
ilk 3 saniyede şaşırtmalı.

FİKİR
Aynı sayfanın birkaç Chrome penceresi açılır. Hepsi ekranın tamamını kaplayan TEK bir ortak dünyanın parçalarını gösterir:
her pencere, ekrandaki konumuna göre o dünyaya açılan bir camdır. Dünyada parlayan bir top var. Top yalnız pencerelerin
içinde var olabilir: bir pencerenin kenarına çarptığında, o noktada başka bir pencere üst üste biniyorsa topa yol açılır ve
diğer pencereye geçer; binmiyorsa seker. Kullanıcı pencereleri sürükleyerek yol kurar. Hedef, ekranın bir yerinde duran
yıldıza topu ulaştırmak. Yıldız da yalnız onu kapsayan pencereden görünür.

TEKNİK TEMEL
Referans: https://github.com/bgstaal/multipleWindow3dScene (pencereler window.screenX/screenY ve localStorage ile
birbirini bilir, Three.js sahnesi pencere konumuna göre kaydırılır, böylece sahne pencereler arasında kesintisiz görünür).
Aynı yaklaşımı kullan:
- Vite + Three.js, tek sayfa (npm run dev). Ek sunucu yok.
- Pencere senkronu: BroadcastChannel (yedek olarak localStorage 'storage' olayı). Her pencere kendi kimliğini, ekran
  dikdörtgenini (screenX, screenY, innerWidth, innerHeight; tarayıcı çubuğu payını hesaba kat) her karede yayınlar;
  kapanan pencere 'beforeunload' ile listeden çıkar, 2 saniye sinyal vermeyen pencere düşer.
- Dünya koordinatı = ekran pikseli. Kamera ortografik; her pencere kendi dikdörtgenini gösterir.
- Fizik tek pencerede çalışır (en eski pencere "lider"); lider topun konum ve hızını yayınlar, diğerleri yalnız çizer.
  Lider kapanırsa sıradaki devralır.
- Çarpışma: top yarıçapı r. Topun bir sonraki konumu, pencere dikdörtgenlerinin BİRLEŞİMİ içinde kalıyorsa serbest,
  dışına taşıyorsa ilgili eksende hızı ters çevir (sönümleme 0,9). Yerçekimi yok; top sabit hızla süzülür, sürtünme çok az.
- Hedef yıldız: ekranın rastgele bir köşesine yakın, ilk pencerenin dışında bir noktada. Top yıldıza değince bütün
  pencerelerde aynı anda patlama efekti, ekran beyaz parlar, yeni seviye: yıldız başka yere taşınır, top hızlanır.

GÖRÜNÜM
- Koyu lacivert, neredeyse siyah arka plan; çok hafif ızgara çizgileri (dünyanın ortak olduğunu belli eder: pencereler
  arasında ızgara kesintisiz devam etmeli, bu videonun "vay" anı).
- Top: parlak camgöbeği, arkasında 30 karelik soluk iz (iz de pencereler arasında kesintisiz).
- Bir pencereden diğerine geçiş anında geçilen kenarda kısa bir halka/dalga efekti.
- Yıldız: altın sarısı, yavaş döner, hafif nabız.
- Arayüzde yazı yok; yalnız sol üstte küçük seviye numarası.

KONTROLLER
- Space: topu ilk pencerenin ortasından rastgele yönde fırlat.
- R: seviyeyi sıfırla.
- N: yeni pencere aç (window.open aynı adres, 500x400).

KABUL ÖLÇÜTLERİ
1. İki pencere yan yana ve kısmen üst üste: ızgara ve iz aralarında kesintisiz görünüyor.
2. Pencereler ayrıyken top kenarda sekiyor; pencereyi sürükleyip üst üste bindirince top karşıya geçiyor.
3. Üç pencereyle köprü kurup yıldıza ulaşılabiliyor.
4. Bir pencereyi kapatınca oyun bozulmadan devam ediyor.
5. 60 fps, konsolda hata yok.

Önce kısa bir plan yaz, sonra kodu yaz, `npm run dev` ile çalıştır ve iki pencerede kendin dene. README.md'ye nasıl
çalıştırılacağını ve videoda nasıl çekileceğini (ekran kaydı, pencereleri yavaşça birleştir) yaz.
