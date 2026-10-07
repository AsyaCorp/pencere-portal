# Cursor istemi: Pencere Portalı v2, uzay görünümü

Aşağıdaki metnin tamamını Cursor'un Agent moduna yapıştır.

---

Pencere Portalı mekanik olarak çalışıyor (v1, src/ altında). Şimdi görünümü baştan yap; mekaniğe (senkron, fizik, geçiş,
lider devri, tuşlar) dokunma, yalnız dünyayı, topu, hedefi ve efektleri değiştir. Amaç sosyal medya videosu: izleyici ilk 3
saniyede birkaç pencerenin TEK bir uzaya baktığını anlamalı ve "vay" demeli.

TEMA: Pencereler uzaya açılan lombozlar. Ortam dolu ve canlı olmalı, boş siyah bir uzay OLMAMALI.

1. DEV HALKALI GEZEGEN (görünümün merkezi)
- Ekranın ortasına yakın, ekran genişliğinin yaklaşık %45'i çapında, Satürn benzeri halkalı gezegen. Dünya koordinatında
  sabit durur; böylece pencerelere bölünür ve her pencere onun bir parçasını gösterir. Bölünmenin kesintisiz okunması
  videonun ana anıdır.
- Gezegen: yavaş dönen, bantlı yüzey (shader ile prosedürel, sıcak turuncu-krem-kahve tonları), kenarda atmosfer ışıması
  (fresnel, açık mavi-beyaz), güneş yönünden gölgeli gece tarafı.
- Halkalar: ince, çok katmanlı, yarı saydam; gezegenin önünden ve arkasından doğru sırayla geçer, gezegen halkaya gölge düşürür.

2. DOLU ORTAM (boşluk yok)
- Arka planda renkli bulutsu katmanları (mor, macenta, camgöbeği; prosedürel gürültü shader'ı), yavaşça kıpırdar.
- Üç katman yıldız: uzak küçük, orta, yakın parlak (bazıları ışın saçan). Hafif paralaks: pencere taşınırken yakın katman
  biraz daha hızlı kayar, derinlik hissi verir (yine de katmanlar pencereler arasında kesintisiz kalmalı).
- Uzak bir sarmal galaksi, birkaç yavaş süzülen asteroit kümesi, gezegenin etrafında ince toz ve buz parçacıkları.
- Ara sıra bir pencereden diğerine geçen kayan yıldız.

3. TOP = KUYRUKLU YILDIZ
- Parlak beyaz-camgöbeği çekirdek, bloom ile ışıldar.
- Arkasında uzun, kıvrılan, giderek incelen kuyruk (parçacık + şerit); kuyruk pencereler arasında kesintisiz.
- Pencere kenarından geçerken geçiş noktasında küçük ışık kırılması; sektiğinde kıvılcım saçılması.

4. HEDEF = KARA DELİK
- Siyah merkez, etrafında dönen parlak yığılma diski (turuncu-beyaz), çevresindeki yıldızları ve bulutsuyu büken
  kütleçekimsel mercek efekti (ekran uzayında bozulma shader'ı).
- Kuyruklu yıldız yaklaşınca kara delik onu kendine çeker (son 150 px'de çekim kuvveti), sarmal çizerek içine düşer.
- Yutma anı: bütün pencerelerde aynı anda ışık bir an içe çöker, sonra beyaz bir şok dalgası tüm ekrana yayılır, kısa ekran
  sarsıntısı; yeni seviyede kara delik başka yerde belirir.

5. GENEL
- Three.js postprocessing: UnrealBloomPass, hafif film grain, vinyet. 60 fps kalmalı; düşerse önce parçacık sayısını azalt.
- Arayüzde yazı yok; sol üstte küçük, ince yazılı seviye numarası.
- Bütün görsel öğeler dünya (ekran) koordinatında tanımlı olmalı ki her pencerede doğru parça görünsün.

KABUL ÖLÇÜTLERİ
1. İki pencere yan yana: gezegen, halkalar, bulutsu ve yıldızlar aralarında kaymadan, kesintisiz devam ediyor.
2. Hiçbir pencerede boş, düz siyah bir alan kalmıyor.
3. Kuyruklu yıldız kara deliğe sarmal çizerek düşüyor ve final efekti bütün pencerelerde aynı anda oluyor.
4. v1'in beş mekanik ölçütü hâlâ geçiyor, 60 fps, konsolda hata yok.

Bitince iki pencerenin ekran görüntüsünü gerçek konumlarına göre birleştirip göster. README'deki video çekim rehberini
güncelle: ilk kare gezegenin iki pencereye bölünmüş hâli, sonra pencereleri yavaşça birleştir.
