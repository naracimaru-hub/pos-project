# Kasir General POS

Aplikasi kasir sederhana berbasis React + Vite, siap di-deploy ke Vercel.

## Fitur
- Transaksi kasir dan keranjang belanja
- Pembayaran tunai, transfer, QRIS
- Diskon, pajak, dan uang kembalian
- Produk, kategori, SKU, harga, dan stok
- Riwayat transaksi, cetak struk, ekspor CSV
- Ringkasan penjualan
- Data tersimpan di localStorage browser, terpisah berdasarkan toko aktif
- Alur login / registrasi, pembuatan toko, dan pemilihan toko

## Konfigurasi publik Supabase
1. Salin `.env.example` menjadi `.env.local`.
2. Isi variabel:
   ```bash
   VITE_SUPABASE_URL=https://<project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon-key>
   ```
3. Dengan konfigurasi tersebut, login/registrasi, daftar membership toko, pembuatan toko melalui RPC `create_store(p_name)`, serta baca/tambah/edit/hapus produk dan riwayat transaksi memakai Supabase Auth dan RLS.
4. Pastikan policy RLS project membatasi `products`, `sales`, `sale_items`, `stores`, dan `store_members` berdasarkan membership yang sesuai. Browser selalu memakai anon/publishable key dan sesi pengguna; jangan menaruh service-role key atau secret di frontend.
5. Buka **Supabase Dashboard → SQL Editor**, tinjau lalu jalankan isi `supabase/migrations/20261018174500_atomic_checkout_and_multistore.sql` secara manual pada project yang benar. Migrasi ini tidak diterapkan otomatis oleh aplikasi atau build. Fungsi `create_store` dalam SQL tersebut didefinisikan dengan parameter `p_name text`, sesuai argumen RPC aplikasi.
6. Jalankan `npm install` dan `npm run build`; jalankan aplikasi lokal dengan `npm run dev`.

## Instalasi di ponsel
Aplikasi dapat dipasang sebagai PWA dari domain HTTPS produksi:
- Android: buka situs lewat Chrome atau browser yang mendukung, lalu pilih **Pasang aplikasi** atau **Tambahkan ke layar utama**.
- iPhone/iPad: buka situs lewat Safari, ketuk **Bagikan**, lalu pilih **Tambahkan ke Layar Utama**.
- Service worker menyimpan shell aplikasi dan aset statis untuk membantu membuka halaman saat offline. Data Supabase, transaksi online, dan API tidak disimpan atau disinkronkan secara offline.

## Status penyimpanan
- Badge di bagian atas menunjukkan apakah data saat ini online atau hanya lokal.
- Tanpa konfigurasi Supabase atau saat belum login, POS tetap berjalan dalam mode demo lokal di `localStorage`. Data lokal tidak tersinkron ke perangkat lain. Pengguna yang sudah login tanpa membership hanya melihat alur pembuatan toko, bukan data demo seolah tersimpan online.
- Produk dan riwayat transaksi pada toko online dimuat berdasarkan `store_id`; pembatasan akses tetap ditegakkan oleh RLS.
- Checkout toko online selalu memakai RPC atomik `checkout_sale`; harga dan stok diambil/dikunci dari database. Jika RPC gagal, termasuk saat offline, checkout menampilkan error dan mempertahankan keranjang; transaksi toko online tidak dialihkan diam-diam menjadi transaksi lokal.

RPC checkout menerima `store_id`, item berisi ID produk dan kuantitas, diskon, tarif pajak, metode pembayaran, dan uang tunai. Fungsi memverifikasi membership, mengunci produk dalam urutan konsisten, menggunakan harga database, menghitung total, memasukkan penjualan dan detail, serta mengurangi stok dalam satu transaksi. Hak eksekusi diberikan hanya ke `authenticated`; tidak diperlukan service-role key.

## Jalankan di komputer
1. Install Node.js versi LTS: https://nodejs.org
2. Ekstrak ZIP ini.
3. Buka terminal di folder proyek.
4. Jalankan:
   ```bash
   npm install
   npm run dev
   ```
5. Buka alamat lokal yang ditampilkan Vite, biasanya http://localhost:5173.

## Deploy ke Vercel
### Cara paling mudah: GitHub
1. Buat repository baru di GitHub.
2. Upload seluruh isi folder proyek ke repository (bukan ZIP-nya).
3. Masuk ke https://vercel.com dan login dengan GitHub.
4. Pilih **Add New → Project**, lalu import repository tadi.
5. Framework Preset: **Vite**. Build Command: `npm run build`. Output Directory: `dist`.
6. Tambahkan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` pada **Project Settings → Environment Variables** untuk environment yang akan di-deploy. Jangan menambahkan service-role key.
7. Klik **Deploy** (atau redeploy setelah mengubah environment variables). Vercel akan memberi URL publik.
8. Tambahkan URL publik pada pengaturan redirect URL Supabase Auth, lalu login/registrasi dan buat toko pertama dari pemilih toko.

### Catatan skema yang diberikan
Migrasi mengganti `create_store(p_name text)` agar akun terautentikasi dapat membuat beberapa toko. Setiap toko dan membership owner baru dibuat atomik; membership toko yang sudah ada tidak dihapus atau diubah.
