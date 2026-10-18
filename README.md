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
3. Konfigurasi ini mengaktifkan Supabase Auth. Akses data toko online masih dinonaktifkan sampai skema aktual dan kebijakan RLS project diverifikasi.
4. Cocokkan implementasi data dengan skema yang benar-benar tersedia dan pastikan RLS membatasi akses berdasarkan membership toko sebelum mengaktifkan sinkronisasi.
5. Jangan menaruh service-role key atau secret di frontend.

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
6. Klik **Deploy**. Vercel akan memberi URL publik.

### Catatan penting
Versi ini menyimpan data pada browser/perangkat yang dipakai. Data tidak otomatis tersinkron antar perangkat, dan bisa hilang jika data situs/browser dibersihkan. Jangan gunakan sebagai satu-satunya catatan transaksi bisnis sebelum memasang database dan backup. Untuk produksi multi-user, tambahkan database (mis. Supabase/Neon), autentikasi, validasi server, dan kontrol akses.
