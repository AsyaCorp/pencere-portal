# Cursor istemi: Pencere Portalı v3, görev kontrol HUD'u

Aşağıdaki metnin tamamını Cursor'un Agent moduna yapıştır.

---

v2'nin uzay görünümü (gezegen, mor bulutsu, kuyruklu yıldız, kara delik) iptal. Hedef kitle yetişkin, teknolojiye meraklı
izleyici; görüntü çocuksu, renkli, "oyuncak" durmamalı. Yeni yön: SpaceX görev kontrolü / askeri takip ekranı estetiği.
Ciddi, temiz, pahalı. Her pencere görev kontrolündeki bir monitör; hepsi aynı yörünge haritasının farklı parçasını gösteriyor.

Mekanik (senkron, lider devri, pencere birleşimi içinde hareket, geçiş, sekme, tuşlar) aynı kalır. src/world/ altındaki v2
görsellerini ve bloom/grain gibi efektleri kaldır; yeni görünümü sıfırdan, sade yaz.

RENK VE TİPOGRAFİ
- Zemin neredeyse siyah (#07080a). Bütün çizgiler ince (1 px, retina'da 0,5 px gibi keskin), beyaz ve gri tonlarında.
- TEK vurgu rengi kırmızı-turuncu (#ff3b1f): yalnız hedef, kilitlenme ve uyarılar. Başka renk yok. Parlama/bloom yok;
  yalnız çok hafif çizgi parlaklığı.
- Yazı: tek aralıklı (monospace) font, küçük (10-11 px), büyük harf, harf aralığı geniş. IBM Plex Mono ya da JetBrains Mono.

ORTAK DÜNYA (pencereler arasında kesintisiz, videonun "vay" anı)
- Ekranın tamamına yayılan teknik harita: ince koordinat ızgarası, her 100 px'de küçük tik ve koordinat etiketi.
- Ekran merkezinde büyük, tel kafes (wireframe) bir Dünya: yalnız enlem/boylam çizgileri ve kıta kıyı hatları (basit
  GeoJSON ya da düşük çözünürlüklü kıyı verisi), yavaşça döner. Etrafında 2-3 ince elips yörünge çizgisi, üzerinde yavaş
  ilerleyen küçük uydu noktaları ve etiketleri (ör. "SAT-07"). Dünya ve yörüngeler birkaç pencereye bölünür.
- Bu öğeler sabit dünya koordinatında; pencere taşındıkça harita "altında kayar", izleyici pencerelerin tek bir haritaya
  baktığını anında anlar.

HER PENCERE BİR MONİTÖR
- Pencere kenarına içten ince çerçeve, köşelerde L şeklinde köşebentler.
- Sol üst: monitör kimliği (TRK-01, TRK-02 ... açılış sırasına göre) ve küçük yanıp sönen "LIVE".
- Sağ üst: bu pencerenin ekran koordinatları, pencere taşınırken canlı değişir (ör. "X 0412  Y 0188"). Meta ve çok
  etkileyici; mutlaka olsun.
- Alt şerit: o monitörün gördüğü alanın küçük bir özet satırı (ör. "SECTOR 3  GRID 04-07").

ROKET / SONDA (top yerine)
- Küçük, keskin bir ok/üçgen ikon, gidiş yönüne döner. Yanında küçük telemetri etiketi: ID ("PRB-1"), hız, yön açısı,
  canlı güncellenir; etiket ikonu ince bir çizgiyle takip eder.
- Arkasında kesik çizgili (dashed) iz; önünde soluk, noktalı tahmini rota çizgisi (bir sonraki sekmeye kadar). İkisi de
  pencereler arasında kesintisiz.
- Bir pencereden diğerine geçerken geçiş noktasında küçük bir "handoff" işareti: kısa yanıp sönen köşeli parantez ve
  "HANDOFF TRK-01 > TRK-02" etiketi.
- Sektiğinde kenarda küçük bir çarpma işareti (kırmızı değil, beyaz).

HEDEF: KENETLENME NOKTASI
- Kırmızı: ince daire + artı nişangâh + "DOCK" etiketi ve mesafe sayacı (sonda yaklaştıkça azalır).
- Sonda yakına gelince (150 px) nişangâhın dört köşebenti içe doğru kapanır, "LOCK" yazısı yanıp söner; v2'deki çekim
  mantığı kalabilir ama sarmal değil, yumuşak bir yanaşma çizgisi.
- Kenetlenince: bütün pencerelerde aynı anda kısa bir beyaz tarama çizgisi (scanline) ekrandan geçer, ortada büyük
  monospace "DOCKED" ve "MISSION 02" yazar, 1,5 saniye sonra yeni hedef başka yerde belirir.

MEKANİK DÜZELTMESİ
- Fırlatma açısı eksenlere 15 dereceden yakın olmasın (v1'de %3 fırlatmada sonda aynı çizgide gidip geliyordu).
- Sonda 20 saniye içinde başka pencereye geçemezse ve hiçbir geçit yoksa yönünü hafifçe rastgele değiştir.

GENEL
- Arayüzdeki tüm yazılar HUD etiketi; başka başlık, açıklama yok.
- 60 fps, konsolda hata yok. v1'in beş mekanik ölçütü geçmeli.

KABUL ÖLÇÜTLERİ
1. Görüntüde kırmızı dışında renk yok; hiçbir yerde mor, mavi, gradyan, bloom yok.
2. İki pencere yan yana: ızgara, tel kafes Dünya, yörüngeler, iz ve tahmini rota aralarında kesintisiz.
3. Pencere taşınırken sağ üstteki koordinatlar canlı değişiyor.
4. Handoff etiketi, LOCK ve DOCKED akışı çalışıyor, final bütün pencerelerde aynı anda.

Bitince iki pencerenin birleşik ekran görüntüsünü göster. README'deki çekim rehberini yeni görünüme göre güncelle.
