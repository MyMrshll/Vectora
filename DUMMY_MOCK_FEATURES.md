# 📂 Rekapitulasi Fitur Mock & Fallback (Dummy) di Vectora

Dokumen ini menyajikan daftar dan penjelasan lengkap mengenai seluruh mekanisme **Mock, Fallback, dan Dummy** yang diimplementasikan di Vectora. Fitur-fitur ini dirancang secara cerdas agar platform tetap dapat beroperasi secara penuh (fully functional) dalam mode pengujian lokal, meskipun API Key eksternal belum dikonfigurasi atau koneksi database utama mengalami gangguan.

---

## 🛠️ Daftar Mekanisme Mock & Fallback

Secara umum, terdapat **6 lapis pengaman (graceful degradation)** yang secara otomatis mendeteksi ketiadaan dependensi eksternal dan mengaktifkan simulasi fungsionalitas cerdas:

### 1. Mock Embedding Generator (768 Dimensi)
* **Kondisi Aktif:** Ketika `GEMINI_API_KEY` tidak disetel atau masih menggunakan nilai bawaan (`your-api-key`) di berkas konfigurasi `.env`.
* **Perilaku Sistem:** 
  * Alur ingestion dokumen tidak akan terhenti. Sistem secara dinamis melewati pemanggilan API Gemini dan menghasilkan vektor 768-dimensi acak (uniform float antara `-0.1` dan `0.1`).
  * Hal ini memungkinkan berkas scraper (JSON, XML, CSV) tetap berhasil diproses, di-chunk, dan dimasukkan ke dalam basis data vektor lokal tanpa mengalami error API.
* **Lokasi Kode:** [rag_service.py](file:///media/DATA_KERJA/Vectora/backend/app/services/rag_service.py#L47-L50)

### 2. Mock LLM Response (RAG Answer Generator)
* **Kondisi Aktif:** Ketika pengguna mengirimkan pertanyaan di playground RAG tetapi `GEMINI_API_KEY` tidak terdeteksi.
* **Perilaku Sistem:** 
  * Daripada mengembalikan error kegagalan, sistem menghasilkan jawaban sintetis berformat:
    ```text
    [MOCK ANSWER - GEMINI KEY NOT SET]

    Based on your RAG source documents, here is the answer: This is a synthetic response simulating Gemini's output. To get actual responses, please configure GEMINI_API_KEY in your .env file.
    ```
  * Respons ini mensimulasikan format jawaban asli dari LLM dan melampirkan teks dokumen pendukung yang berhasil diretrieve agar pengguna dapat memverifikasi relevansi pencarian semantik.
* **Lokasi Kode:** [rag_service.py](file:///media/DATA_KERJA/Vectora/backend/app/services/rag_service.py#L74-L77)

### 3. Mock Hubungan Relasional (Interactive Knowledge Graph)
* **Kondisi Aktif:** Ketika mode pencarian **Graph RAG** digunakan tanpa `GEMINI_API_KEY`, atau ketika ekstraksi relasi terstruktur via Gemini mengalami kendala (seperti kegagalan parse skema JSON, limit kuota, atau timeout).
* **Perilaku Sistem:**
  * Sistem memicu fallback `_get_mock_graph()` yang mengembalikan struktur jaringan graf pra-definisi dengan **5 entitas penting** dan **5 relasi terhubung**:
    * **Nodes:**
      * `Vectora System` (Tipe: Software)
      * `Graph RAG` (Tipe: Concept)
      * `Relational Entity` (Tipe: Concept)
      * `Qdrant Store` (Tipe: Software)
      * `Gemini 3.1 Flash` (Tipe: Software)
    * **Edges (Relasi):**
      * `Vectora System` ➔ *implements* ➔ `Graph RAG`
      * `Graph RAG` ➔ *extracts* ➔ `Relational Entity`
      * `Vectora System` ➔ *integrates* ➔ `Qdrant Store`
      * `Vectora System` ➔ *utilizes* ➔ `Gemini 3.1 Flash`
      * `Gemini 3.1 Flash` ➔ *powers* ➔ `Graph RAG`
  * Struktur dummy graf ini dirender secara interaktif di canvas **D3 SVG Graph** pada frontend, lengkap dengan animasi relaksasi pegas, pewarnaan kategori, dan sorotan hover.
* **Lokasi Kode:** [rag_service.py](file:///media/DATA_KERJA/Vectora/backend/app/services/rag_service.py#L283-L304)

### 4. Mock Source Chunks (Pencarian Vektor Kosong)
* **Kondisi Aktif:** Ketika pencarian semantik dipicu namun database vektor kosong (tidak ada dokumen yang terindeks), atau ketika koneksi ke kluster Vector DB gagal.
* **Perilaku Sistem:**
  * Menyelipkan fragmen dokumen tiruan ke dalam konteks dengan isi:
    ```text
    Ini adalah konten tiruan (mock) karena vector store Anda kosong atau koneksi vector store gagal.
    ```
  * Menjamin alur penggabungan konteks LLM tidak bernilai `null` atau `empty`, sehingga respons LLM tidak menghasilkan *crash* pada parser markup.
* **Lokasi Kode:** [rag_service.py](file:///media/DATA_KERJA/Vectora/backend/app/services/rag_service.py#L219-L224)

### 5. In-Memory Vector Store Fallback (Qdrant Client :memory:)
* **Kondisi Aktif:** Jika pengguna tidak mendaftarkan Vector DB eksternal, atau koneksi ke alamat kluster Qdrant/Chroma yang terdaftar di database utama terputus.
* **Perilaku Sistem:**
  * Secara otomatis menginisialisasi objek klien Qdrant lokal dalam memori (`location=":memory:"`).
  * Seluruh pengujian *indexing* dokumen scraping, penghapusan, dan pencarian kemiripan tetap dapat berjalan 100% lancar di RAM lokal tanpa membutuhkan instalasi Docker Qdrant di komputer.
* **Lokasi Kode:** [vector_store.py](file:///media/DATA_KERJA/Vectora/backend/app/core/vector_store.py#L210-L215)

### 6. In-Memory SQLite / Collection Fallback (Tanpa Server DB)
* **Kondisi Aktif:** Ketika Prisma ORM tidak dapat terhubung ke server database relasional lokal (Postgres/SQLite).
* **Perilaku Sistem:**
  * Seluruh tabel riwayat pencarian (Audit Logs), berkas dokumen, dan konfigurasi database dialihkan secara otomatis ke array in-memory python (`in_memory_query_logs`, `in_memory_documents`, dsb.).
  * Mencegah aplikasi mengalami kegagalan *startup* (crash on boot) dan tetap mempertahankan keselarasan status halaman dashboard dokumen.
* **Lokasi Kode:** [database.py](file:///media/DATA_KERJA/Vectora/backend/app/core/database.py)

---

## 💡 Keuntungan Arsitektur Fallback Ini
1. **Zero Setup Developer Experience (DX):** Developer baru dapat langsung melakukan `pnpm dev` dan `python main.py` lalu menguji seluruh fitur playground secara instan tanpa perlu menyiapkan API Key, kluster Qdrant, atau Postgres lokal terlebih dahulu.
2. **Kekebalan dari Kegagalan Layanan (Fault Tolerance):** Jika layanan eksternal (seperti Google Gemini API atau AWS Qdrant Cloud) mengalami pemadaman/limitasi mendadak, Vectora tetap berjalan stabil dengan merender mode simulasi.
