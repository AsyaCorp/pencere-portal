# Pencere Portalı

Birden fazla tarayıcı penceresi tek bir görev kontrol ekranının monitörleri gibi davranır. Ekranın ortasında dönen tel kafes bir Dünya, onun etrafında uydu yörüngeleri ve bütün ekranı kaplayan bir koordinat gridi var; her pencere bunun bir parçasını gösterir. Pencereleri üst üste bindirerek sondaya (PRB-1) yol açar, onu kırmızı kenetlenme hedefine (DOCK) ulaştırırsın.

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
