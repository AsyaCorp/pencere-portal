# Pencere Portalı

Birden fazla tarayıcı penceresi tek bir görev kontrol ekranının monitörleri gibi davranır. Ekranın ortasında dönen tel kafes bir Dünya, onun etrafında uydu yörüngeleri ve bütün ekranı kaplayan bir koordinat gridi var; her pencere bunun bir parçasını gösterir. Pencereleri üst üste bindirerek sondaya (PRB-1) yol açar, onu kırmızı kenetlenme hedefine (DOCK) ulaştırırsın.

İkinci bir mod olarak **Titan modu** da var (T tuşu ya da `?mod=titan`). Aynı pencere mekaniği bu kez kızıl bir gün batımında, surla çevrili üç boyutlu bir şehirde, gerçek insan modelleriyle çalışır. Ayrıntılar aşağıdaki [Titan modu](#titan-modu) bölümünde.

Esin: [Bjørn Staal, multipleWindow3dScene](https://github.com/bgstaal/multipleWindow3dScene).

## Çalıştırma

```bash
npm install
npm run dev
```

Chrome'da `http://localhost:5173/` adresini aç. Ek pencereleri sayfadayken **N** ile aç (500x400 açılır pencere). Aynı adresi elle yeni pencerede açmak da olur, ama sekme değil **ayrı pencere** olmalı.

| Tuş   | İş                                                              |
| ----- | --------------------------------------------------------------- |
| Space | Sondayı ilk (en eski) pencerenin ortasından rastgele fırlat     |
| R     | Görevi sıfırla                                                  |
| N     | Yeni pencere aç                                                 |
| T     | HUD ile Titan modu arasında geç (bütün pencerelerde aynı anda)  |

Kurallar: Sonda yalnız pencerelerin içinde var olabilir. Kenara çarptığında orada başka bir pencere üst üste biniyorsa karşıya geçer (`HANDOFF TRK-01 > TRK-02`), binmiyorsa beyaz bir çarpma işareti bırakıp seker. Fırlatma açısı eksenlere hiçbir zaman 15°'den yakın olmaz. Sonda 20 sn boyunca başka pencereye geçemezse yönü hafifçe rastgele değişir. Hedef bir pencerenin içindeyse ve sonda ona 150 px yaklaşırsa kilitlenir (`LOCK`): köşe parantezleri daralır, sonda yumuşak bir yaklaşma çizgisiyle hedefe süzülür. Kenetlenince bütün pencerelerde aynı anda beyaz bir tarama çizgisi ekranı süpürür ve `DOCKED / MISSION NN` yazısı çıkar. 1,5 sn sonra yeni hedef başka bir köşede belirir. Geçit için iki pencerenin örtüşen kenarı en az 28 px olmalı.

## Görünüm

- Zemin `#07080a`; çizgiler yalnız beyaz ve gri tonlarında, 1 px (retina ekranda 0,5 px).
- Tek vurgu rengi `#ff3b1f`. Yalnız hedefte, kilitte ve uyarıda kullanılır. Bloom, gradyan ya da başka renk yok.
- Yazılar IBM Plex Mono, 8–11 px, büyük harf ve geniş harf aralığıyla.
- Her pencere bir monitördür:
  - L köşeli iç çerçeve.
  - Sol üstte açılış sırasına göre `TRK-01…` ve yanıp sönen `LIVE`.
  - Sağ üstte pencerenin canlı ekran koordinatı.
  - Altta sektör/grid şeridi ve temas durumu (`PRB-1 IN VIEW` / `NO CONTACT`).

## Nasıl çalışıyor

- `src/sync.js`: Her pencere her karede kimliğini, açılış zamanını ve içerik alanının ekran dikdörtgenini (tarayıcı çubuğu payı düşülmüş) `BroadcastChannel` ile yayınlar. `BroadcastChannel` yoksa `localStorage` olayına düşer. 2 sn susan pencere listeden çıkar, kapanan pencere `bye` gönderir.
- `src/game.js`: Fizik yalnız liderde (görünür en eski pencere) çalışır. Sonda pencere dikdörtgenlerinin birleşimi içinde kalır ve taşan eksende seker. Kilitlenince hızı yumuşakça hedefe yönelir. Lider kapanınca sıradaki pencere son durumu devralır.
- `src/scene.js` ve `src/view/`: Canvas 2D ile çizilir. Dünya koordinatı ekran pikseline eşittir: her pencere çizimi kendi ekran konumu kadar kaydırır. Grid, Dünya, yörüngeler, iz ve öngörülen rota yalnız ekrana ve ortak saate bağlı olduğundan pencereler arasında kesintisiz birleşir. Efektler de ortak saatle zamanlanır, bu yüzden DOCKED her pencerede aynı karede oynar.
  - `map.js`: grid; her 100 px'te tik ve koordinat etiketi; 3x3 sektör.
  - `earth.js`: Dünya. Ortografik izdüşümle enlem/boylam ağı ve `world-atlas` kıyı çizgileri; yörüngeler ve uydular.
  - `probe.js`: sonda okunu, kesikli izi, sonraki sekmeye kadar noktalı öngörülen rotayı ve DOCK hedefini çizer.
  - `hud.js`: monitör çerçevesi.
  - `fx.js`: çarpma, HANDOFF ve DOCKED efektleri.

## Video çekimi

1. Ekranı sadeleştir: masaüstü simgelerini gizle, Dock'u otomatik gizle. Koyu duvar kâğıdı seç ki pencere araları da görüntüye uysun.
2. Pencereleri **N** ile aç (açılır pencere modu: sekmesiz, ince çubuk). İki pencereyi büyüt (yaklaşık 650x780) ve Dünya'nın sol ve sağ yarısına koy, aralarında 20–40 px boşluk kalsın. Üçüncü pencereyi kenarda hazır tut.
3. Ekran kaydını başlat: macOS'ta `Cmd+Shift+5` ile "Tüm Ekranı Kaydet" (ya da OBS, 60 fps). İnce çizgiler sıkıştırmada kaybolmasın diye retina çözünürlüğünde ve yüksek bit hızıyla kaydet. Dikey video için ekranın ortasında dar bir alan seç.
4. **İlk kare:** Dünya iki monitöre bölünmüş, TRK-01 ve TRK-02 etiketleri görünüyor. İzleyici iki ayrı pencerenin aynı haritayı gösterdiğini burada anlar; 1–2 sn hiçbir şeye dokunma.
5. Sağdaki pencereyi **yavaşça** sola sürükleyip soldakine bindir. Sağ üstteki koordinat sayaçları canlı akar; kıyı çizgileri, grid ve yörüngeler kaymadan birleşir. Videonun "vay" anı bu.
6. **Space**'e bas. Sonda fırlar, telemetri etiketi (hız, yön) peşinden gelir, önünde noktalı rota bir sonraki sekmeyi gösterir. Örtüşen kenardan geçerken `HANDOFF TRK-01 > TRK-02` yanıp söner.
7. Üçüncü pencereyi kırmızı DOCK hedefinin olduğu yere götür ve ortadakiyle köprü kur. Sonda yaklaşınca köşe parantezleri kapanır, `LOCK` yanıp söner. Kenetlenme anında beyaz tarama çizgisi bütün monitörleri aynı anda süpürür ve büyük `DOCKED` yazısı belirir.
8. İpuçları:
   - Hedef her zaman ekranın dört köşesinden birinin yakınında belirir. Bir pencereyi köşelerde gezdirince kırmızı köşeler ve `DST` sayacı onu ele verir.
   - Sondanın içinde olduğu pencereyi hızlı sürüklersen sonda pencereyle birlikte taşınır.
   - Yavaş hareketler hem okunaklı hem etkileyici görünür.
   - Kırmızıyı yalnız kilit anına saklamak için ilk karelerde hedefi kadraj dışında tut.

## Titan modu

`http://localhost:5173/?mod=titan` ile ya da herhangi bir pencerede **T** ile açılır; T bütün pencereleri aynı anda çevirir, tekrar basınca HUD'a döner. Pencere senkronu, lider devri ve N ortaktır; oyun ve çizim `src/titan/` altında ayrı durur.

| Tuş   | İş                                                    |
| ----- | ----------------------------------------------------- |
| Fare  | Nişan al; sol tık basılı: kanca at ve kendini çek     |
| A / D | Yerde yürü, havada yön ver (ok tuşları da çalışır)    |
| Space | Gaz püskürt (fare yönüne itki, kısa bekleme süreli)   |
| R     | Titan sahnesini sıfırla                               |
| N     | Yeni pencere aç (açık modda)                          |
| T     | HUD moduna dön                                        |

**Dünya:**

- three.js ile çizilen tek bir 3B sahne. Ekran büyük bir "portal" gibi davranır: göz ekranın önünde sabit durur, her pencere kendi ekran konumuna göre eğik (off-axis) bir izdüşümle bu sahnenin kendine düşen parçasını gösterir. Bu yüzden gökyüzü, sur, şehir ve Colossal pencereler arasında kaymadan birleşir.
- Bütün ekrana yayılan tek bir gün batımı: shader ile bordo-turuncu gökyüzü, katmanlı bulutlar ve surun hemen üstünde batan güneş.
- Ekran boyunca uzanan dev taş sur, önünde kırmızı kiremitli, ahşap çatkılı (fachwerk) evlerden oluşan sık bir şehir, çan kuleleri, bacalardan yükselen duman ve askerlerin hedefi olan taş gözetleme kulesi. Kule ekran genişliğinin %62'sindedir.
- Arkadan vuran gün ışığı gölge düşürür, karakterlerin kenarları sıcak bir çizgiyle parlar. Uzaklar sise gömülür, havada kor süzülür, bloom ile ışıklar hafif taşar.
- Zemin ekran yüksekliğinin %80'inde sabit bir çizgidir ve yalnız o çizgiyi içeren pencerelerde vardır. Pencereler arasındaki boşluk uçurumdur.

**Karakterler:**

- **Levi.** Oyuncunun yönettiği rig'li ve animasyonlu asker; yeşil pelerin koşarken ve salınırken dalgalanır. Kanca halatı ve her gaz püskürmesinde iz var.
- **Devler (saf titanlar).** Gerçekçi insan bedenleri: çıplak ten, uzun kollar, kimi iri kimi küçük kafa, yüzlerinde fazla geniş, donuk bir sırıtma (yüz blendshape'leri abartılarak). Yürüme, koşma ve bekleme animasyonları bu iskelete dünya uzayında yeniden hedeflenir. Başları yavaşça yana düşer ve izleyiciye döner.
- **Colossal Titan.** Gerçek bir 3B kafa taramasının üzerine derisiz kas dokusu (yüzün ortasından yelpaze gibi açılan lifler), yanaklarda açıkta dişler ve kızıl parlayan gözler.

**Oyun: Ense Avı**

- **Kanca.** Kanca yalnız bir pencerenin içinde görünen yapılara (ev, çatı, kule, sur, devler) tutunur. Nişangâh tıklamanın tutup tutmayacağını gösterir. Menzil ekranın yaklaşık %60'ı. Pencereler arasındaki boşluk uçurumdur; düşen Levi bir can kaybeder.
- **Ense.** Levi bir devin ensesinden yeterli hızla geçerse onu keser: kısa bir ağır çekim olur, sayaç artar. Yavaş geçiş saymaz; gazla ve kancayla hız kazanmak gerekir.
- **Devler.** Aynı anda en fazla 3 dev, pencerelerin verdiği zeminde Levi'ye yürür ya da koşar. Atlayamaz, kanca atamazlar; uçuruma gelince kenarda durup kol sallarlar. Pencereleri ayırırsan geride kalırlar, birleştirirsen zemin birleşir ve geçerler. Bir dev Levi'yi yakalarsa can gider.
- **Can ve skor.** 3 can. 5 ense kesilince Colossal Titan surun arkasından yükselir; yüzü ve omuzları birden fazla pencereye bölünür.
- **Final.** Colossal hazır olduktan sonra 25 sn içinde ensesine ulaşıp keserseniz kazanırsınız. Süre dolarsa bütün pencerelerde beyaz-turuncu şok dalgası, buhar ve sarsıntı gelir ve oyun kaybedilir. Oyun sonunda sahne birkaç saniye sonra sıfırlanır. Her şey ortak saatle zamanlanır; simülasyonu lider pencere yürütür, diğerleri onun durumunu çizer.

### Reels çekimi (dikey 9:16)

Dikey kadraj, ekranın ortasında **ekran yüksekliği × 9/16** genişliğinde bir şerittir. Örnek: 1710x986 ekranda yaklaşık 555 px, x 577–1132 arası. Dünya (HUD), kule ve Colossal'ın yüzü bu şeride sığacak biçimde yerleştirildi.

1. Ekranı sadeleştir (masaüstü simgeleri gizli, Dock otomatik gizlenir, koyu duvar kâğıdı).
2. Pencereleri şu sırayla aç ve şeride yerleştir:
   - **Üst pencere.** Adresi normal bir Chrome penceresinde aç. Bu, en eski pencere olur ve lideri o tutar. Şeridin tam genişliğine, ekranın üst üçte birine yerleştir (örnek: 555x360, y 40). HUD'da Dünya'nın üst yarısını, Titan finalinde Colossal'ın gözlerini gösterir.
   - **Sol alt pencere.** N ile aç. Yaklaşık 250 px genişliğinde olsun; ekran yüksekliğinin %45'inden altına kadar uzansın (örnek: 250x560, y 420). Zemin çizgisi (%80) içinde kalmalı; askerler ve devler burada başlar.
   - **Sağ alt pencere.** Yine N ile aç. Sol alttakinin 30–40 px sağında olsun, şeridin sağ kenarına kadar uzansın (örnek: 265x560). Kule bu pencerenin içinde kalır.
3. Kaydı başlat: `Cmd+Shift+5` ile tüm ekranı ya da OBS ile 60 fps kaydet. Sonra şeridi 9:16 olarak kırp. İnce çizgiler için retina çözünürlüğünde ve yüksek bit hızıyla kaydet.
4. **HUD bölümü (ilk ~8 sn).**
   - Dünya üç monitöre bölünmüş durumda; 1–2 sn dokunma.
   - Bir alt pencereyi yavaşça kaydır: koordinatlar akar, harita kaymadan birleşir.
   - Space ile sondayı fırlat; HANDOFF anını göster.
5. **Geçiş.** **T**'ye bas. Üç pencere aynı karede görev kontrolünden kızıl gökyüzüne döner. Bu kesmesiz geçiş, iki modu bağlayan an. 1 sn bekle ki izleyici şehri ve devleri seçsin.
6. **Kaçış.**
   - Sağ alt pencereyi başta şeridin dışına, sağa çek (boşluk 280 px'ten geniş). Space'e bas: askerler kenarda bekleyip el sallar, devler buhar saçarak yaklaşır.
   - Tam yetişecekken sağ pencereyi şeride geri sürükle (boşluk 30–40 px). Askerler kancayla karşıya salınır, devler kenarda kalıp boşluğa uzanır. Kabul ölçütündeki an bu.
   - İstersen pencereleri bir an birleştir: devler de geçer. Hemen ayırınca yine geride kalırlar.
7. **Final.**
   - Üç asker kulenin tepesine çıkınca kayda dokunma: gökyüzü kararır ve Colossal'ın yüzü surun arkasından üst pencereyi doldurarak yükselir; burnu ve dişleri surun hemen üstünde kalır.
   - Gözler kızarınca (~3,5 sn) şok dalgası gelir; her pencerede aynı anda patlar ve sarsar.
   - Kaydı sahne sıfırlandıktan 1 sn sonra kes.
8. İpuçları:
   - Kule, ekran genişliğinin %62'sindedir. Kadrajı değiştirirsen sağ alt pencerenin kuleyi içermesine dikkat et.
   - Askerler zemini olan en soldaki pencerede başlar. Devlerin arkadan gelmesi için kuleyi en sağda bırak.
   - Sahne bir kayıtta beklemediğin bir yere gittiyse **R** ile sıfırla. Askerler Space'e kadar bekler.

### Modeller ve lisanslar

> Modeller depoda yok. Aşağıdaki bağlantılardan GLB olarak indirip `public/models/` altına tablodaki adlarla koy. `Soldier.glb` ve `Xbot.glb` three.js deposundaki `examples/models/gltf/` klasöründe.

Resmî Attack on Titan materyali (stüdyo görselleri, müzik, logo) kullanılmaz. Şehir, sur, kule, gökyüzü ve efektler kodla üretilir. Karakterler Sketchfab'daki CC BY lisanslı **hayran yapımı** modellerdir (`public/models/`). Bunlar telifli karakterlerin türevleridir. Bir kısmı (Smiling Titan, Levi, Armin) büyük olasılıkla AoT oyunlarından çıkarılmıştır. Kendi bilgisayarında oynamak sorun değil; kaydı yayınlarsan telif bildirimi riski senin üzerindedir. Mixamo animasyonları, ad eşleyen bir dünya uzayı yeniden hedeflemesiyle bu Biped/Mixamo iskeletlerine aktarılır.

| Dosya          | Kullanım                                  | Kaynak (CC BY 4.0, yazar)                                                                                                                                                  |
| -------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Colossal.glb` | Colossal Titan (çığlık animasyonuyla)     | [Attack on Titan - Screaming Colossal](https://sketchfab.com/3d-models/3624c46aabc745fba12e305c527b4635), overlordofyou; model [Colossal Titan](https://sketchfab.com/3d-models/e031a57fd4bf411f8e893361676b4544), Sidaivan |
| `Smiler.glb`   | Saf titanlar                              | [Aot Smiling Titan rig](https://sketchfab.com/3d-models/d697d4856d724144beccfd7471d9f5c9), ianadrielbravo                                                                   |
| `Levi.glb`     | Askerler                                  | [Levi Ackerman rig](https://sketchfab.com/3d-models/01ffa989559941ef807cc07b3fed40b8), ianadrielbravo                                                                       |
| `Armin.glb`    | Askerler                                  | [Aotwa_armin_arlelt rig](https://sketchfab.com/3d-models/eb79c080ba4645df8246bcf81ae8c759), ianadrielbravo                                                                  |
| `Soldier.glb`  | Asker animasyonlarının kaynağı            | three.js örnekleri (Mixamo kökenli)                                                                                                                                        |
| `Xbot.glb`     | Titan animasyonlarının kaynağı            | three.js örnekleri (Mixamo kökenli)                                                                                                                                        |
