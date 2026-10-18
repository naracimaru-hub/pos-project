# Kasir General POS

Aplikasi kasir sederhana berbasis React + Vite, siap di-deploy ke Vercel.

## Fitur
- Transaksi kasir dan keranjang belanja
- Pembayaran tunai, transfer, QRIS
- Diskon, pajak, dan uang kembalian
- Produk, kategori, SKU, harga, dan stok
- Riwayat transaksi, cetak struk, ekspor CSV
- Ringkasan penjualan
- Data tersimpan di localStorage browser

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
