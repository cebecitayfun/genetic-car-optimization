UYGULAMALI YAPAY ZEKA - PROJE RAPORU

Proje Başlığı: Optimizasyon Simülasyonu / Genetik Algoritma ile 2D Araçların Evrimi
Öğrenci Adı: Tayfun Cebeci
Öğrenci Numarası: 220901749

------------------------------------------------------------

1. GIRIS VE SECILEN PROBLEM

Bu uygulamalı programlama projesi için "Kategori 3: Optimizasyon Simülasyonu" başlığını seçerek, doğal seçilimi simüle eden kapsamlı bir Genetik Algoritma aracı tasarladım. Bu uygulamanın çözmeyi amaçladığı temel problem, fiziksel tasarım ve navigasyon optimizasyonudur: Öngörülemeyen, sonsuz uzunlukta ve oldukça engebeli bir araziyi takla atmadan veya sıkışıp kalmadan aşabilecek 2D bir aracın evrim yoluyla tasarlanmasıdır.

Araziyi aşmak için kural tabanlı sabit kodlar yazmak yerine, bu simülasyon gerçek dünya kısıtlamalarını (yerçekimi, sürtünme, atalet ve motor torku) uygulamak için bir fizik motoru kullanır. Genetik Algoritma ise sürekli olarak optimum yerel ve küresel maksimum konfigürasyonları (araç gövde şekilleri, tekerlek boyutları, tekerlek yerleşimleri ve motor gücü) arar.


2. ALGORITMANIN TEORIK VE MATEMATIKSEL ALTYAPISI

Burada uygulanan Genetik Algoritma, Darwin'in doğal seçilim teorisinden ilham alır ve aşağıdaki temel evreleri takip eder:

A. Baslangic (Genom Kodlamasi / Initialization)
Bir "Genom", tek bir aracı temsil eder. Her genom, rastgele atanmış sürekli sayısal parametreler içerir:
- radii: 8 kenarlı içbükey poligon gövdeyi (pizza dilimi yöntemiyle) oluşturmak için merkez noktadan köşelere olan uzaklıklar.
- wheelNode1, wheelNode2: İki adet tekerleğin gövdeye hangi spesifik köşelerden (akslar aracılığıyla) bağlanacağını belirleyen değişkenler.
- wheelR1, wheelR2: Dairesel tekerleklerin yarıçapları.
- motorSpeed: İki tekerleğe birden uygulanan motor tork gücü.
- density, wheelDensity: Atalet momentini hesaplamak için kritik olan, gövde ve tekerleklerin kütle yoğunluğu dağılımı.

B. Uygunluk Degerlendirmesi (Fitness Evaluation)
Düzenlenen popülasyon boyutundaki her araç, simülasyonda aynı anda doğar. Fizik motoru, araçların hareketlerini zaman içinde entegre eder. Uygunluk (Fitness) fonksiyonu matematiksel olarak basittir ancak evrim için son derece etkilidir:

Formül: F(x) = max(X_pozisyon)

Bir aracın uygunluk puanı (skoru), araç ölmeden (sıkışma, takla atma veya zaman sınırının dolması sebebiyle) X ekseninde kat ettiği maksimum yatay mesafedir.

C. Secilim (Selection & Elitism)
Optimum çözümlerin kaybolmasını önlemek ve nesiller arası genetik sapmayı engellemek için katı bir Elitizm Seçilimi uygulanır. Neslin sonunda tüm popülasyon skoruna göre büyükten küçüğe sıralanır:
- En iyi performans gösteren araçlar (Elitler), keşfedilen mutlak maksimumları korumak adına hiçbir değişime uğramadan doğrudan bir sonraki nesle klonlanır.
- Ebeveyn havuzu, tamamen popülasyonun en iyi yari diliminden seçilir. Zayıf özelliklere sahip araçlar acımasızca elenir.

D. Caprazlama ve Mutasyon (Crossover & Mutation)
Aramanın sadece yerel maksimumlara takılıp kalmasını önlemek için Çaprazlama ve Mutasyon uygulanır:
- Caprazlama (Crossover): Seçilen ebeveynler belirgin özelliklerini karıştırır (Örnek: Ebeveyn A'nin tekerlek yarıçapları, Ebeveyn B'nin gövde ağırlığı ve motor gücüyle birleştirilir).
- Surekli Mutasyon (Continuous Mutation): Yeni doğan çocuk araçların genlerine, belirli bir olasılıkla sınırlı bir gürültü varyasyonu eklenir. 

Formül: Yeni_Yaricap = Eski_Yaricap + Delta

Buradaki Delta, ampirik limitler arasına sıkıştırılmış rastgele bir skaler sayıdır. Bu matematiksel sapma mekanizması sayesinde algoritma, yakın çevredeki sürekli çözüm uzayını genişleterek arar.


3. KOD MIMARISI OZETI

Yazılım; HTML5, CSS3, Vanilla JavaScript ve 2D fizik simülasyonları için Matter.js kütüphanesi kullanılarak geliştirilmiştir. Mimari, tamamen Nesne Yönelimli Programlama prensiplerine uygun olarak aşağıdaki belirli modüllere ayrılmıştır:

- index.html & style.css (Arayuz Katmani): Kullanıcı etkileşimlerini (zamanı hızlandırma, nesil atlama, mutasyon oranını belirleme) sağlar. Ayrıca Chart.js kullanılarak her neslin maksimum performansını gösteren canlı performans grafikleri ekrana çizilir.

- engine.js (Fizik ve Simulasyon Kontrolcusu): Fizik motoru entegrasyonunu yönetir. Birbirine kilitlenmiş katı dikdörtgen cisimler (harita içinden geçmeyi önleyen zemin stratejisi) kullanarak prosedürel fiziksel araziyi üretir. Çarpışmaları, çarpışma toleransını ve global yerçekimini yöneten ana zaman döngüsüdür.

- car.js (Fiziksel Modelleme Katmani): Matematiksel genom verisini alır ve fiziksel nesnelere dönüştürür. 8 adet dışbükey üçgen cismi bir araya getirerek düzgün yüzeyli içbükey yıldız şekilli gövdeler üretmek gibi karmaşık hesaplamaları üstlenir. İmpulsif sıçramaları önlemek için tekerleklere rotasyon hızını aniden değil de tork uygulayarak gerçekçi sürüş sağlar.

- genetic.js (Algoritma Cekirdegi): Fizik motorundan tamamen bağımsız, soyutlanmış bir katmandır. Yalnızca genetik veri yapılarını işler; puanlama, ebeveyn seçim olasılıkları, çaprazlama kuralları ve mutasyon limitlerini sınırlandırma matematiğini kapsar.
