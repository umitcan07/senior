 ---
  Genel Bakış

  Bu dizin, POWSM (ESPnet tabanlı çok görevli konuşma modeli) kullanarak telaffuz değerlendirmesi yapan bir deney
   ortamı. Temel akış şu:

  1. Ses kayıtlarını uygun formata dönüştür
  2. POWSM ile fonetik analiz yap (Phone Recognition, G2P, ASR)
  3. Hedef telaffuzla karşılaştır, hataları tespit et
  4. MFA ile zaman damgası eşlemesi yap

  ---
  Python Script'leri

  compressor.py — Dinamik Aralık Kompresörü

  Basit bir feed-forward audio compressor. Ses dosyasının dinamik aralığını daraltır:
  - Threshold: -18 dBFS üzerindeki sinyalleri sıkıştırır
  - Ratio: 4:1 oranında kompresyon
  - Attack/Release: 5ms / 100ms zaman sabitleri
  - Envelope follower ile sinyal zarfını takip eder (numba JIT desteği var)
  - pyloudnorm ile LUFS loudness analizi yapar
  - Giriş/çıkış dalga formlarını matplotlib ile görselleştirir

  dbfs.py — Loudness Analizi & Streaming Karşılaştırması

  Bir ses dosyasının LUFS ve dBFS değerlerini ölçer ve streaming platformlarının hedef loudness değerleriyle     
  karşılaştırır:
  - Spotify (-14 LUFS), Apple Music (-16 LUFS), YouTube (-14 LUFS), Tidal, Amazon Music, EBU R128
  - Dosyanın bu hedeflere göre ne kadar yüksek/düşük olduğunu raporlar

  ---
  Jupyter Notebook'ları

  m4a.ipynb — M4A → WAV Dönüştürücü (Genel)

  audio/development/ruken/ altındaki .m4a dosyalarını 16kHz mono WAV'a dönüştürür. PyAV kütüphanesi ile m4a      
  decode eder (Windows'ta soundfile m4a desteklemediği için).

  powsm.ipynb — Ana POWSM Deney Notebook'u (Batch İşlem)

  audio/powsm/ altındaki tüm cümle dizinlerini toplu işler. İki ana bölüm var:

  1. M4A → WAV Dönüştürme: Her cümle dizinindeki m4a dosyalarını 16kHz, 16-bit, mono, 20 saniye WAV'a çevirir    
  (POWSM'un beklediği format). Kısa dosyalar sıfırla pad'lenir, uzunlar kesilir.
  2. Phone Recognition (PR): POWSM modelini kullanarak her ses dosyasından fonem dizisi çıkarır. Önce dil tespiti
   (Speech2Language), sonra PR (<pr> task) çalıştırır. Sonuçları JSON ve TXT olarak kaydeder.
  3. Audio-guided G2P: İki aşamalı süreç:
    - Önce ASR ile metni tanır
    - Sonra ASR çıktısını prompt olarak kullanıp G2P (<g2p> task) ile ses rehberliğinde fonem dönüşümü yapar     
    - Bu, konuşmacının gerçek telaffuzuna dayalı hedef fonem dizisi üretir

  powsm-demo.ipynb — POWSM Demo/Keşif

  POWSM'un 4 görevini tek bir ses dosyası (pi_mono_trimmed.wav) üzerinde dener:
  - PR (Phone Recognition): Sesten fonem dizisi çıkarır
  - ASR (Automatic Speech Recognition): Sesten metin çıkarır
  - G2P (Grapheme-to-Phoneme): ASR metnini foneme çevirir (ses rehberli)
  - P2G (Phoneme-to-Grapheme): Fonemlerden metin üretir

  Ayrıca ses dosyasının özelliklerini (sample rate, RMS, min/max) diagnostik amaçlı kontrol eder. Bu notebook    
  deneme/öğrenme amaçlı — pi ses dosyası muhtemelen doğal konuşma değil, bu yüzden sonuçlarda ⁇ (unknown token)  
  çok çıkıyor.

  powsm_minimal.ipynb — Minimal Telaffuz Karşılaştırması

  Tek bir ses dosyası (umit12-r.wav) için minimal bir pipeline:
  1. CMU sözlüğü ile hedef metnin IPA fonemlerini üretir (ARPAbet → IPA dönüşümü)
  2. POWSM PR ile gerçek telaffuzu çıkarır
  3. POWSM G2P ile ses rehberli hedef fonemleri üretir
  4. edit_distance modülü ile düzenleme uzaklığı (substitution/insertion/deletion) hesaplar
  5. Sonuçları powsm_minimal.json'a kaydeder

  Cache sistemi var — aynı dosya için tekrar model çalıştırmamak için.

  audio_quality.ipynb — Ses Kalitesi Metrikleri

  Ses dosyalarının kalitesini ölçen kapsamlı araçlar:
  - SNR (Signal-to-Noise Ratio): VAD tabanlı veya spectral subtraction ile gürültü tahmini yapıp SNR hesaplar    
  - VAD (Voice Activity Detection): Enerji tabanlı konuşma/sessizlik tespiti
  - Empty segment detection: Sessiz/neredeyse boş bölgeleri tespit eder
  - Clipping ratio: Ses sinyalinde kırpılma (distortion) oranını hesaplar
  - Terminal'de renkli segment görselleştirmesi (yeşil=konuşma, sarı=gürültü, kırmızı=sessizlik)

  audio/development/ruken/ dizinindeki WAV dosyalarını analiz eder.

  assessment.ipynb — Tam Telaffuz Değerlendirme Pipeline'ı

  En kapsamlı notebook. Tüm adımları birleştirir:

  1. POWSM modelleri yüklenir (PR, ASR, G2P, language detection)
  2. MFA (Montreal Forced Aligner) entegrasyonu — conda ortamından MFA'yı bulur ve kullanır. MFA, ses ile metin  
  arasında zaman damgalı fonem hizalaması yapar
  3. Ses dosyası trimlenip MFA'ya verilir (leading/trailing silence kaldırılır)
  4. PR ile gerçek telaffuz, G2P ile hedef telaffuz çıkarılır
  5. Edit distance ile hatalar tespit edilir (substitution, insertion, deletion)
  6. Hatalar MFA zaman damgalarına eşlenir — hangi saniyede hangi hata var
  7. Kelime düzeyinde karşılaştırma da yapılır (Word Error Rate)
  8. Sonuçlar JSON'a kaydedilir: skor (%93.53), WER (%21.74), hata detayları, zaman damgaları

  MFA bulunamazsa tahmini zaman damgaları kullanılır. Beam size parametreleri ile MFA hizalama kalitesi optimize 
  edilir.

  ---
  Veri Dosyaları

  ┌──────────────────────────────┬────────────────────────────────────────────┐
  │            Dosya             │                   İçerik                   │
  ├──────────────────────────────┼────────────────────────────────────────────┤
  │ audio/powsm/12/text, 14/text │ Hedef cümle transkriptleri                 │
  ├──────────────────────────────┼────────────────────────────────────────────┤
  │ audio/powsm/12/*.m4a         │ Ham ses kayıtları (umit, yusuf)            │
  ├──────────────────────────────┼────────────────────────────────────────────┤
  │ audio/powsm/12/*-r.wav       │ Dönüştürülmüş 16kHz WAV'lar                │
  ├──────────────────────────────┼────────────────────────────────────────────┤
  │ powsm_pr_results.json/txt    │ Phone Recognition sonuçları                │
  ├──────────────────────────────┼────────────────────────────────────────────┤
  │ powsm_g2p_results.json/txt   │ G2P sonuçları                              │
  ├──────────────────────────────┼────────────────────────────────────────────┤
  │ powsm_minimal.json           │ Minimal karşılaştırma sonucu               │
  ├──────────────────────────────┼────────────────────────────────────────────┤
  │ powsm.txt                    │ POWSM ile ilgili notlar/döküman            │
  ├──────────────────────────────┼────────────────────────────────────────────┤
  │ results/*.json               │ assessment.ipynb çıktıları (tarih damgalı) │
  └──────────────────────────────┴────────────────────────────────────────────┘

  ---
  Özet Akış

  m4a ses kayıtları
      ↓ (m4a.ipynb / powsm.ipynb)
  16kHz mono WAV
      ↓
  ┌─────────────┬──────────────┐
  │ POWSM PR    │ POWSM G2P    │
  │ (gerçek     │ (hedef       │
  │  telaffuz)  │  telaffuz)   │
  └──────┬──────┴──────┬───────┘
         ↓              ↓
     edit_distance karşılaştırma
         ↓
     MFA zaman damgası eşleme
         ↓
     Skor + Hata Raporu (JSON)

