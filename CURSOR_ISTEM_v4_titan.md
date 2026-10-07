# Cursor istemi: Pencere Portalı, Titan sürümü (v4)

Aşağıdaki metnin tamamını Cursor'un Agent moduna yapıştır.

---

Pencere Portalı v3 (görev kontrol HUD'u) bitti ve onaylandı; ona DOKUNMA. Aynı projeye ikinci bir mod ekle: "Titan modu"
(Attack on Titan'dan esinli). İkisi tek bir Reels videosunda art arda gösterilecek; aynı pencere mekaniği, bambaşka bir dünya.

MOD SEÇİMİ
- Adres `?mod=titan` ile ya da T tuşuyla açılır; T bütün pencerelerde aynı anda modu değiştirir (mevcut senkron kanalıyla).
- Pencere senkronu, lider devri, pencere dikdörtgenleri ve N tuşu ortak kalır. Titan modunun oyun mantığı ve çizimi ayrı
  dosyalarda olsun (src/titan/).

GÖRÜNTÜ: SİYAH SİLUET + KIZIL GÖKYÜZÜ
- Bütün ekrana yayılan TEK bir gün batımı: üstte koyu bordo, ufka doğru kızıl-turuncu, ufukta büyük soluk güneş diski.
  Gökyüzü, güneş ve uzak katmanlar ekran (dünya) koordinatında; pencereler arasında kesintisiz.
- Her şey simsiyah siluet: uzakta dev sur (ekranın tamamı boyunca), sur içinde çatılı şehir silueti, bir yanda yüksek kule
  (hedef). İki-üç derinlik katmanı (uzak katmanlar biraz daha açık ve sisli), ince süzülen kül ve kor parçacıkları.
- Renk yalnız gökyüzünde; karakterler ve yapılar saf siyah. Tek istisna: devlerin buharı (soluk beyaz) ve kanca telleri
  (ince, hafif parlak çizgi). Çizgi film/oyuncak görünümü yok; sinematik ve karanlık. Yazı yok (sol üstte küçük, ince
  "WALL ROSE  SECTOR 3" gibi bir etiket olabilir).

DÜNYA VE ZEMİN
- Ekranın %80 yüksekliğinde sabit bir zemin çizgisi (dünya koordinatı). Karakterler bu zeminde yürür/koşar.
- Zemin yalnız pencerelerin içinde vardır: zemin çizgisini kapsayan pencerelerin yatay aralıklarının birleşimi yürünebilir
  alandır. Pencereler arasındaki boşluk uçurum/karanlıktır.

KARAKTERLER
- Askerler (5 kişi): küçük siyah siluetler, pelerin dalgalanır. Kuleye doğru koşarlar. 3D manevra teçhizatı: önlerinde
  boşluk varsa ve karşı pencerede tutunacak yapı (bina, kule, sur kenarı) 280 px içindeyse kanca atıp ip çizerek salınır
  ve karşıya geçerler; daha uzaksa boşluğun kenarında bekler, ellerini sallarlar.
- Devler (3-4 tane, boyları farklı, 3-5 kat asker boyu): ağır, sallanan yürüyüşlü siyah siluetler, açık ağızlarından ve
  enselerinden ince buhar. En yakın askere doğru yürürler. ATLAYAMAZ ve KANCA ATAMAZLAR: boşluğa gelince kenarda durur,
  karşıya uzanıp eli boşluğa sarkar, öfkeyle sallanırlar.
- Asıl mekanik: kullanıcı pencereleri AYIRINCA devler geride kalır, askerler kancayla kaçar; pencereleri BİRLEŞTİRİNCE zemin
  birleşir ve devler de geçer. Kullanıcı, askerleri kurtarmak için pencerelerle köprü kurup yıkan kişidir.
- Dev bir askere yetişirse: asker buhar bulutunda kaybolur (kan, şiddet detayı yok). Sol üstte küçük sayaç: kalan asker.
- Bir dev arada bir yaklaşan bir askeri fark edip koşmaya başlar (gerilim).

FİNAL: COLOSSAL TITAN
- En az üç asker kulenin tepesine ulaşınca: zemin hafifçe sarsılır, bütün pencerelerde gökyüzü kararır, surun arkasından
  Colossal Titan'ın DEV silueti yükselir. Yüzü ve omuzları bütün ekranı kaplayacak büyüklükte, dünya koordinatında; böylece
  her pencere onun bir parçasını gösterir (videonun "vay" anı: aynı dev yüz bütün pencerelere bölünmüş).
- Siluetin içinde yalnız iki göz çok hafif kızıl parlar; etrafından yoğun beyaz buhar yükselir.
- Sonra bütün pencerelerde aynı anda beyaz-turuncu şok dalgası ve buhar patlaması, ekran sarsıntısı, 2 sn sonra sahne
  sıfırlanır. Hepsi ortak saatle zamanlanır, her pencerede aynı anda olur.

KONTROLLER
- T: mod değiştir.  R: Titan modunu sıfırla.  N: yeni pencere.  Space: askerleri başlat (sahne başta durur).



KABUL ÖLÇÜTLERİ
1. İki pencere ayrık: askerler kancayla karşıya geçiyor, devler kenarda kalıyor.
2. Pencereler birleşince devler de geçiyor.
3. Gökyüzü, güneş, sur ve şehir pencereler arasında kesintisiz; renk yalnız gökyüzünde.
4. Final: Colossal'ın yüzü bütün pencerelere bölünmüş görünüyor; şok dalgası her pencerede aynı anda.
5. T ile HUD moduna dönülünce v3 bozulmadan çalışıyor. 60 fps, konsolda hata yok.

Bitince üç pencerenin birleşik ekran görüntüsünü (normal an + final anı) göster. README'ye Titan modu için çekim rehberi
ekle: dikey 9:16 Reels'e uygun pencere dizilimi, önce HUD modu, T ile Titan moduna geçiş, finalde Colossal.
