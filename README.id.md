<div align="center">
  <img src="./assets/vectora_logo.png" alt="Vectora Logo" width="240px" style="border-radius: 24px; margin-bottom: 20px;" />

  # ⚡ Vectora

  ### Control Plane Administrasi & Orkestrasi RAG Berkinerja Tinggi  [![Python](https://img.shields.io/badge/Python-3.10%2B-blueviolet?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org)
  [![FastAPI](https://img.shields.io/badge/FastAPI-v0.110%2B-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
  [![Next.js](https://img.shields.io/badge/Next.js-v16-black?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org)
  [![Qdrant](https://img.shields.io/badge/Qdrant-VectorStore-red?style=for-the-badge&logo=qdrant&logoColor=white)](https://qdrant.tech)
  [![Gemini](https://img.shields.io/badge/Google_Gemini-Cognitive_AI-blue?style=for-the-badge&logo=google-gemini&logoColor=white)](https://ai.google.dev)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

  <p align="center" style="margin-top: 15px;">
    <a href="./README.md">🇬🇧 <b>English</b></a> &nbsp;•&nbsp;
    <span>🇮🇩 <b>Bahasa Indonesia</b></span>
  </p>

  <p align="center" style="margin-top: 20px;">
    <a href="#pipeline-ingestion--pencarian">🧠 <b>Pipeline RAG</b></a> &nbsp;•&nbsp;
    <a href="#instalasi--pengembangan-lokal">🌐 <b>Dashboard Web</b></a> &nbsp;•&nbsp;
    <a href="#verifikasi-otomatis">📊 <b>Telemetri Sistem</b></a> &nbsp;•&nbsp;
    <a href="#referensi-konfigurasi-env">🛠️ <b>Konfigurasi</b></a>
  </p>
</div>

Vectora adalah Control Plane Administrasi dan Orkestrasi Retrieval-Augmented Generation (RAG) berkinerja tinggi kelas enterprise. Sistem ini dirancang untuk developer, arsitek sistem, dan operator AI untuk mengonfigurasi, memantau, dan mengoptimalkan siklus pencarian kognitif.

Aplikasi ini dilengkapi dengan dashboard glassmorphism terpadu yang berorientasi pada pengembang, telemetri log real-time, visualisasi chunk vektor, serta manajemen pipeline yang andal.

---

## Topologi Arsitektur

```
             ┌──────────────────────────────────────────────┐
             │            User Interface Next.js            │
             │   (Dashboard Admin / Konsol Glassmorphic)    │
             └──────────────────────┬───────────────────────┘
                                    │ HTTP / WebSocket REST APIs
                                    ▼
             ┌──────────────────────────────────────────────┐
             │              API Core FastAPI                │
             │  (Asynchronous Document Parsing & Ingestion) │
             └───────┬──────────────┬──────────────┬────────┘
                     │              │              │
    Embeddings &     │              │              │ In-Memory atau Cadangan
    Grounded prompts │              │              │ Metadata Relasional Supabase
                      ▼              │              ▼
        ┌────────────────────────┐   │   ┌────────────────────────┐
        │   Google Gemini APIs   │   │   │     PostgreSQL DB      │
        │  (text-embedding-004)  │   │   │   (Chunk Persistence)  │
        │   (gemini-1.5-flash)   │   │   └────────────────────────┘
        └────────────────────────┘   │
                                     ▼
                        ┌────────────────────────┐
                        │  Qdrant Vector Engine  │
                        │   (Cos-Sim Indexing)   │
                        └────────────────────────┘
```

Topologi Vectora terdiri dari empat lapisan decoupled:
1. **Lapisan Presentasi (Next.js)**: Didesain menggunakan sistem gaya visual kustom. Antarmuka pengguna menyertakan panel modular untuk pengindeksan dokumen, eksplorasi chunk, playground kueri telemetri, logging sistem, dan registri model aktif.
2. **Lapisan Orkestrasi Utama (FastAPI)**: Mengatur penyerapan berkas, menginisiasi background task asinkron, mengelola telemetri pipeline, dan memformat kueri API.
3. **Engine Indeks Vektor (Qdrant)**: Menyimpan dan mengindeks embedding semantik. Vectora mendukung penyimpanan memori ringan (`:memory:`) untuk pengembangan cepat lokal, serta koneksi ke klaster Qdrant Cloud produksi.
4. **Lapisan Penalaran Kognitif (Google Gemini)**: Mengonversi fragmen teks menjadi embedding dimensi tinggi menggunakan model `text-embedding-004` (768 dimensi), dan menyintesis jawaban kueri berbasis konteks dengan `gemini-1.5-flash`.

---

## Pipeline Ingestion & Pencarian

### Pipeline Ingestion (Penyerapan)
1. **Penyerapan Dokumen**: Berkas tidak terstruktur (seperti `.txt` or `.md`) diunggah melalui endpoint FastAPI `/api/documents/`.
2. **Pemrosesan Latar Belakang**: FastAPI menempatkan berkas pada queue latar belakang non-blocking untuk menjaga responsivitas antarmuka.
3. **Pemisahan Teks Rekursif**: Teks diekstrak dan dibagi menggunakan `RecursiveCharacterTextSplitter` dari LangChain menjadi fragmen terstruktur (ukuran default: `1000` karakter, overlap: `200` karakter).
4. **Generasi Vektor**: Chunk teks diparsing dan divektorisasi menggunakan model `text-embedding-004` Google Gemini. Mekanisme mock fallback yang andal akan aktif secara otomatis jika `GEMINI_API_KEY` tidak terdeteksi.
5. **Indeks Koleksi**: Vektor berdimensi 768 disimpan ke koleksi Qdrant bernama `vectora_documents` dengan konfigurasi **Cosine Distance**.
6. **Sinkronisasi Relasional**: Chunk direplikasi ke cadangan relasional sekunder (Supabase) jika dikonfigurasi; jika tidak, sistem akan dialihkan dengan mulus ke struktur kamus memori standar.

### Pipeline Pencarian dan Sintesis RAG
1. **Vektorosasi Kueri**: Pertanyaan bahasa alami pengguna dipetakan ke dalam ruang vektor berdimensi 768 menggunakan model `text-embedding-004`.
2. **Pencarian K-Nearest Neighbors**: Vektor kueri dibandingkan dengan vektor koleksi Qdrant menggunakan kesamaan Cosine. Poin kecocokan teratas (top-k) diambil.
3. **Rekonstruksi Konteks**: Chunk dokumen sumber dikumpulkan dan diformat menjadi prompt konteks yang sangat relevan.
4. **Sintesis Jawaban**: Prompt hasil rekonstruksi dikirimkan ke model `gemini-1.5-flash` Google Gemini untuk menyusun balasan yang akurat dan berbasis dokumen.
5. **Telemetri Log**: Statistik setiap kueri—termasuk latensi mentah, referensi sumber, skor jarak, dan estimasi jumlah token—disimpan di database log kueri untuk audit sistem.

---

## Referensi Konfigurasi (.env)

Layanan backend membaca konfigurasi dari berkas `.env` di direktori utama proyek atau di dalam folder `/backend`.

```ini
# Pengaturan FastAPI
PROJECT_NAME="Vectora API"
DEBUG=true

# Konfigurasi Qdrant
# Gunakan ":memory:" untuk penyimpanan memori lokal sementara (membutuhkan paket qdrant-client).
# Gunakan "http://localhost:6333" untuk Docker lokal atau URL Qdrant Cloud jarak jauh.
QDRANT_URL=:memory:
QDRANT_API_KEY=

# Konfigurasi Google Gemini
# Dapatkan kunci developer Anda dari konsol Google AI Studio.
GEMINI_API_KEY=kunci-gemini-api-anda

# Konfigurasi Cadangan Relasional (Opsional)
# Jika disediakan, metadata chunk dokumen akan disinkronkan ke Supabase.
SUPABASE_URL=url-proyek-supabase-anda
SUPABASE_KEY=anon-key-supabase-anda
```

---

## Instalasi & Pengembangan Lokal

### Persyaratan Sistem
* Python 3.10+
* Node.js v18+
* Manajer Paket: `pnpm` (frontend), `pip` (backend)

### Jalankan Backend

1. Masuk ke direktori backend:
   ```bash
   cd backend
   ```

2. Buat virtual environment dan aktifkan:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Instal paket Python yang dibutuhkan:
   ```bash
   pip install -r requirements.txt
   ```

4. Jalankan server FastAPI:
   ```bash
   python3 app/main.py
   ```
   Dokumentasi API interaktif dapat diakses di `http://localhost:8000/docs`.

### Jalankan Frontend

1. Masuk ke direktori frontend:
   ```bash
   cd ../frontend
   ```

2. Instal dependensi frontend:
   ```bash
   pnpm install
   ```

3. Jalankan server pengembangan Next.js:
   ```bash
   pnpm dev
   ```
   Aplikasi dashboard Next.js dapat diakses di `http://localhost:3000`.

---

## Verifikasi Otomatis

Vectora dilengkapi dengan skrip pengujian otomatis untuk memverifikasi kesehatan pipeline ingestion dan kueri:

1. Aktifkan virtual environment Anda dan jalankan skrip tes:
   ```bash
   cd backend
   * Untuk menguji pipeline secara utuh:
   python3 test_api.py
   ```

2. Skrip pengujian otomatis akan melakukan aksi berikut:
   * Menghubungkan ke server FastAPI yang sedang aktif.
   * Memverifikasi endpoint `/health` dan `/api/models/`.
   * Mengunggah berkas pengetahuan uji coba (`test_knowledge.txt`).
   * Memverifikasi pemisahan rekursif teks dan penyerapan vektor ke Qdrant.
   * Menguji kueri sistem RAG terintegrasi untuk validasi pengambilan data.
   * Memastikan telemetri tersimpan dengan benar di `/api/query/logs`.
   * Melakukan pembersihan data indeks uji coba secara otomatis.

---

## Lisensi

Proyek ini dilisensikan di bawah Lisensi MIT - lihat berkas [LICENSE](LICENSE) untuk informasi lebih lanjut.

Hak Cipta (c) 2026 Ferta Junindi. Hak cipta dilindungi undang-undang.
