# Pencere Portalı

Birden fazla tarayıcı penceresi aynı uzaya açılan lombozlar gibi davranır: ekranın ortasında dev, halkalı bir gezegen durur ve her pencere onun bir parçasını gösterir. Pencereleri üst üste bindirerek kuyruklu yıldıza yol açar, onu kara deliğe ulaştırırsın.

Esin: [Bjørn Staal, multipleWindow3dScene](https://github.com/bgstaal/multipleWindow3dScene).

## Çalıştırma

```bash
npm install
npm run dev
```

Chrome'da `http://localhost:5173/` adresini aç. Ek pencereleri sayfadayken **N** ile aç (500x400 açılır pencere). Aynı adresi elle yeni pencerede açmak da olur, ama sekme değil **ayrı pencere** olmalı.

| Tuş   | İş                                                                  |
| ----- | ------------------------------------------------------------------- |
| Space | Kuyruklu yıldızı ilk (en eski) pencerenin ortasından rastgele fırlat |
| R     | Seviyeyi sıfırla                                                    |
| N     | Yeni pencere aç                                                     |

Kurallar: kuyruklu yıldız yalnız pencerelerin içinde var olabilir. Kenara çarptığında orada başka bir pencere üst üste biniyorsa karşıya geçer, binmiyorsa kıvılcım saçarak seker. Kara delik ekranın bir köşesinde durur ve yalnız onu kapsayan pencereden görünür. Kuyruklu yıldız deliğin 150 px yakınına girince (delik bir pencerenin içindeyse) çekilir, sarmal çizerek düşer; seviye artar, yeni delik başka yerde belirir. Geçit için iki pencerenin örtüşen kenarı en az 28 px olmalı.

## Nasıl çalışıyor

- `src/sync.js`: Her pencere her karede kimliğini ve içerik alanının ekran dikdörtgenini (tarayıcı çubuğu payı düşülmüş) `BroadcastChannel` ile yayınlar; yoksa `localStorage` olayına düşer. 2 sn susan pencere listeden çıkar, kapanan pencere `bye` gönderir.
- `src/game.js`: Fizik yalnız liderde (görünür en eski pencere) çalışır. Top pencere dikdörtgenlerinin birleşimi içinde kalır, taşan eksende seker (sönüm 0,9). Kara deliğin çekimi hızı içe doğru bir sarmala yönlendirir. Lider kapanınca sıradaki son durumu devralır.
- `src/scene.js` ve `src/world/`: Dünya koordinatı = ekran pikseli. Gezegen, halkalar, bulutsu, yıldızlar, galaksi, asteroitler ve kayan yıldızlar yalnız ekrana ve ortak saate bağlı tanımlıdır; bu yüzden her pencere aynı uzayın doğru parçasını gösterir. Yıldız katmanlarının paralaksı bütün pencerelerin ortak merkezine bağlıdır, pencere taşınınca katmanlar her pencerede aynı miktarda kayar.
- Görüntü işleme: arka plan → kara delik merceği → ön plan → bloom → son geçiş (film grain, vinyet, yutma anındaki içe çöküş ve şok dalgası). Sahne her yönde 96 px payla çizilir; bloom, mercek ve sarsıntı pencere kenarında kesilmez. Pencere 60 fps tutamazsa (çok büyük pencere) iç çözünürlük kendiliğinden düşer.

## Video çekimi

1. Ekranı sadeleştir: masaüstü simgelerini gizle, Dock'u otomatik gizle.
2. Pencereleri **N** ile aç (açılır pencere modu: sekmesiz, ince çubuk). İki pencereyi büyütüp (yaklaşık 600x750) gezegenin sol ve sağ yarısına koy, aralarında 20–40 px boşluk kalsın. Üçüncü pencereyi kenarda hazır tut.
3. Ekran kaydını başlat: macOS'ta `Cmd+Shift+5` → "Tüm Ekranı Kaydet" (ya da OBS, 60 fps). Dikey video için kayıt alanını ekranın ortasında dar bir dikdörtgen seç.
4. **İlk kare:** gezegen iki pencereye bölünmüş hâlde. İzleyici iki ayrı pencerenin aynı gezegeni gösterdiğini burada anlar; 1–2 sn hiçbir şeye dokunma.
5. Sağdaki pencereyi **yavaşça** sola sürükleyip soldakine bindir. Gezegenin bantları ve halkaları kaymadan birleşir, yakın yıldızlar hafifçe kayarak derinlik verir. Videonun "vay" anı bu.
6. **Space**'e bas: kuyruklu yıldız fırlar, kenarlarda kıvılcımla seker, pencereler örtüştüğü yerde ışık kırılmasıyla karşıya geçer.
7. Üçüncü pencereyi kara deliğin olduğu köşeye götür ve ortadakiyle köprü kur. Kuyruklu yıldız deliğe sarmal çizerek düşer: tüm pencerelerde ışık içe çöker, ardından beyaz şok dalgası bütün ekrana yayılır ve ekran sarsılır.
8. İpucu: Kara deliği bulmak için bir pencereyi köşelerde gezdir; merceklenme yıldızları ve halkayı bükerek yerini ele verir. Kuyruklu yıldızın içinde olduğu pencereyi hızlı sürüklersen yıldız pencereyle birlikte taşınır; yavaş hareketler hem okunaklı hem etkileyici görünür.
