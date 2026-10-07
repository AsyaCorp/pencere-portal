# Pencere Portalı

Birden fazla tarayıcı penceresi tek bir ortak dünyaya açılan camlar gibi davranır. Pencereleri üst üste bindirerek topa yol açarsın.

Esin: [Bjørn Staal, multipleWindow3dScene](https://github.com/bgstaal/multipleWindow3dScene).

## Çalıştırma

```bash
npm install
npm run dev
```

Chrome'da `http://localhost:5173/` adresini aç. Ek pencereleri sayfadayken **N** ile aç (500x400 açılır pencere). Aynı adresi elle yeni pencerede açmak da olur, ama sekme değil **ayrı pencere** olmalı.

| Tuş   | İş                                                      |
| ----- | ------------------------------------------------------- |
| Space | Topu ilk (en eski) pencerenin ortasından rastgele fırlat |
| R     | Seviyeyi sıfırla                                        |
| N     | Yeni pencere aç                                         |

Kurallar: top yalnız pencerelerin içinde var olabilir. Kenara çarptığında orada başka bir pencere üst üste biniyorsa karşıya geçer, binmiyorsa seker. Altın yıldız ekranın bir köşesinde durur ve yalnız onu kapsayan pencereden görünür. Topu yıldıza ulaştırınca seviye artar, top hızlanır. Geçit için iki pencerenin örtüşen kenarı en az top çapı (28 px) kadar olmalı.

## Nasıl çalışıyor

- `src/sync.js`: Her pencere her karede kimliğini ve içerik alanının ekran dikdörtgenini (tarayıcı çubuğu payı düşülmüş) `BroadcastChannel` ile yayınlar; yoksa `localStorage` olayına düşer. 2 sn susan pencere listeden çıkar, kapanan pencere `bye` gönderir. Gizli/simge durumundaki pencereler dünyaya dahil edilmez.
- `src/game.js`: Fizik yalnız liderde (görünür en eski pencere) çalışır. Topun çemberi pencere dikdörtgenlerinin birleşimi içinde mi diye bakılır; taşan eksende hız ters çevrilir (sönüm 0,9), ardından top yavaşça seyir hızına döner. Lider kapanınca sıradaki son durumu devralır.
- `src/scene.js`: Dünya koordinatı = ekran pikseli. Her pencerenin ortografik kamerası kendi ekran dikdörtgenini gösterir; ızgara dünya koordinatından shader'da çizildiği için pencereler arasında kesintisiz devam eder. İz noktaları liderden gelir, her pencerede birebir aynıdır. Efektler ortak saatle zamanlanır.

## Video çekimi

1. Ekranı sadeleştir: masaüstü simgelerini gizle, Dock'u otomatik gizle, koyu duvar kağıdı kullan.
2. Pencereleri sekmesiz ve adres çubuğu küçük olsun diye **N** ile aç (açılır pencere modu). Üç pencere yeterli.
3. Ekran kaydını başlat: macOS'ta `Cmd+Shift+5` → "Tüm Ekranı Kaydet" (ya da OBS, 60 fps). Dikey video için kayıt alanını ekranın ortasına dar bir dikdörtgen olarak seç.
4. Açılış (ilk 3 sn): iki pencere ayrık dururken **Space**'e bas, top bir pencerede seksin. Sonra ikinci pencereyi **yavaşça** sürükleyip birincinin kenarına bindir. Izgaranın birleştiği ve topun karşıya geçip halka dalgası çıkardığı an videonun kancası.
5. Üçüncü pencereyi yıldızın olduğu köşeye götür (yıldızın altın ışığı ızgarada belli olur), ortadaki pencereyle köprü kur, topun yıldıza ulaşmasını bekle: tüm pencerelerde patlama ve beyaz parlama.
6. İpucu: Pencereyi hızlı sürüklersen top pencereyle birlikte taşınır; yavaş birleştirme hem daha okunaklı hem daha etkileyici görünür.
