
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { LayoutDashboard, ShoppingCart, Package, ReceiptText, Settings, Search, Plus, Minus, Trash2, CreditCard, Banknote, Smartphone, X, Check, Printer, Menu, TrendingUp, Boxes, CircleDollarSign } from "lucide-react";
import "./style.css";

const initialProducts = [
  { id: 1, name: "Air Mineral 600 ml", sku: "MIN-001", category: "Minuman", price: 4000, stock: 48, color: "#dbeafe" },
  { id: 2, name: "Kopi Susu", sku: "KOP-001", category: "Minuman", price: 12000, stock: 25, color: "#fef3c7" },
  { id: 3, name: "Roti Cokelat", sku: "ROT-001", category: "Makanan", price: 8000, stock: 17, color: "#ffedd5" },
  { id: 4, name: "Mi Instan", sku: "MIE-001", category: "Makanan", price: 3500, stock: 60, color: "#dcfce7" },
  { id: 5, name: "Teh Botol", sku: "TEH-001", category: "Minuman", price: 5000, stock: 32, color: "#fce7f3" },
  { id: 6, name: "Tisu Saku", sku: "TIS-001", category: "Kebutuhan", price: 6000, stock: 20, color: "#ede9fe" },
  { id: 7, name: "Keripik Kentang", sku: "SNK-001", category: "Camilan", price: 10000, stock: 14, color: "#fee2e2" },
  { id: 8, name: "Sabun Mandi", sku: "SAB-001", category: "Kebutuhan", price: 7000, stock: 22, color: "#cffafe" }
];

const rupiah = n => new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0
}).format(n || 0);

const read = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};

function App() {
  const [products, setProducts] = useState(() => read("kg_products", initialProducts));
  const [sales, setSales] = useState(() => read("kg_sales", []));
  const [cart, setCart] = useState([]);
  const [page, setPage] = useState("Kasir");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Semua");
  const [payMethod, setPayMethod] = useState("Tunai");
  const [cash, setCash] = useState("");
  const [discount, setDiscount] = useState("0");
  const [taxRate, setTaxRate] = useState("0");
  const [modal, setModal] = useState(false);
  const [notice, setNotice] = useState("");
  const [productForm, setProductForm] = useState({
    name: "", sku: "", category: "Umum", price: "", stock: ""
  });
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    localStorage.setItem("kg_products", JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem("kg_sales", JSON.stringify(sales));
  }, [sales]);

  const categories = ["Semua", ...new Set(products.map(p => p.category))];

  const visibleProducts = products.filter(p =>
    (category === "Semua" || p.category === category) &&
    `${p.name} ${p.sku}`.toLowerCase().includes(search.toLowerCase())
  );

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discountAmount = Math.min(subtotal, Math.max(0, Number(discount) || 0));
  const tax = Math.round(
    (subtotal - discountAmount) * Math.max(0, Number(taxRate) || 0) / 100
  );
  const total = subtotal - discountAmount + tax;

  const today = new Date().toLocaleDateString("id-ID", {
    day: "2-digit", month: "long", year: "numeric"
  });

  const todaySales = sales.filter(
    s => new Date(s.time).toDateString() === new Date().toDateString()
  );

  const todayRevenue = todaySales.reduce((s, sale) => s + sale.total, 0);

  function addToCart(p) {
    if (p.stock <= 0) return setNotice("Stok produk habis.");

    setCart(old => {
      const found = old.find(i => i.id === p.id);
      if (found) {
        return old.map(i => i.id === p.id
          ? { ...i, qty: Math.min(i.qty + 1, p.stock) }
          : i
        );
      }
      return [...old, { ...p, qty: 1 }];
    });

    setNotice("");
  }

  function changeQty(id, delta) {
    setCart(old => old.map(i => i.id === id
      ? {
          ...i,
          qty: Math.max(
            1,
            Math.min(
              i.qty + delta,
              products.find(p => p.id === id)?.stock ?? i.qty
            )
          )
        }
      : i
    ));
  }

  function checkout() {
    if (!cart.length) return setNotice("Keranjang masih kosong.");

    if (payMethod === "Tunai" && Number(cash) < total) {
      return setNotice("Uang diterima belum mencukupi.");
    }

    const sale = {
      id: `TRX-${Date.now().toString().slice(-8)}`,
      time: new Date().toISOString(),
      items: cart,
      subtotal,
      discount: discountAmount,
      tax,
      total,
      method: payMethod,
      cash: payMethod === "Tunai" ? Number(cash) : total,
      change: payMethod === "Tunai" ? Number(cash) - total : 0
    };

    setSales(old => [sale, ...old]);

    setProducts(old => old.map(p => {
      const item = cart.find(i => i.id === p.id);
      return item ? { ...p, stock: Math.max(0, p.stock - item.qty) } : p;
    }));

    setCart([]);
    setCash("");
    setDiscount("0");
    setNotice("Transaksi berhasil disimpan.");
    setTimeout(() => setNotice(""), 3500);
  }

  function saveProduct(e) {
    e.preventDefault();

    const item = {
      ...productForm,
      price: Number(productForm.price),
      stock: Number(productForm.stock),
      id: editing ?? Date.now(),
      color: "#e0e7ff"
    };

    if (!item.name.trim() || item.price < 0 || item.stock < 0) return;

    setProducts(old => editing
      ? old.map(p => p.id === editing ? item : p)
      : [...old, item]
    );

    setModal(false);
    setEditing(null);
    setProductForm({
      name: "", sku: "", category: "Umum", price: "", stock: ""
    });
  }

  function openEdit(p) {
    setEditing(p.id);
    setProductForm({
      name: p.name,
      sku: p.sku,
      category: p.category,
      price: String(p.price),
      stock: String(p.stock)
    });
    setModal(true);
  }

  function printReceipt(s) {
    const w = window.open("", "_blank", "width=420,height=650");

    if (!w) return setNotice("Izinkan pop-up untuk mencetak struk.");

    w.document.write(`
      <html>
      <head>
        <title>Struk ${s.id}</title>
        <style>
          body { font: 13px monospace; padding: 20px; }
          h2, p { text-align: center; }
          .line { border-top: 1px dashed #555; margin: 12px 0; }
          .row {
            display: flex;
            justify-content: space-between;
            margin: 7px 0;
          }
        </style>
      </head>
      <body>
        <h2>KASIR GENERAL POS</h2>
        <p>Struk Pembelian</p>
        <div class="line"></div>
        <p>${s.id}<br>${new Date(s.time).toLocaleString("id-ID")}</p>
        <div class="line"></div>
        ${s.items.map(i => `
          <div>
            ${i.name}
            <div class="row">
              <span>${i.qty} x ${rupiah(i.price)}</span>
              <b>${rupiah(i.qty * i.price)}</b>
            </div>
          </div>
        `).join("")}
        <div class="line"></div>
        <div class="row"><span>Subtotal</span><b>${rupiah(s.subtotal)}</b></div>
        <div class="row"><span>Diskon</span><b>${rupiah(s.discount)}</b></div>
        <div class="row"><span>Pajak</span><b>${rupiah(s.tax)}</b></div>
        <div class="row"><b>Total</b><b>${rupiah(s.total)}</b></div>
        <div class="row"><span>Metode</span><b>${s.method}</b></div>
        <div class="row"><span>Kembalian</span><b>${rupiah(s.change)}</b></div>
        <div class="line"></div>
        <p>Terima kasih sudah berbelanja!</p>
        <script>window.print()<\/script>
      </body>
      </html>
    `);

    w.document.close();
  }

  const nav = [
    { name: "Ringkasan", icon: LayoutDashboard },
    { name: "Kasir", icon: ShoppingCart },
    { name: "Produk", icon: Package },
    { name: "Transaksi", icon: ReceiptText },
    { name: "Pengaturan", icon: Settings }
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon"><ShoppingCart size={21} /></div>
          <div>
            <strong>Kasir<span>POS</span></strong>
            <small>GENERAL EDITION</small>
          </div>
        </div>

        <div className="store-label">MENU UTAMA</div>

        <nav>
          {nav.map(n => (
            <button
              key={n.name}
              className={`nav-item ${page === n.name ? "active" : ""}`}
              onClick={() => {
                setPage(n.name);
                setNotice("");
              }}
            >
              <n.icon size={18} />
              <span>{n.name}</span>
              {n.name === "Kasir" && cart.length > 0 &&
                <b className="nav-count">
                  {cart.reduce((s, i) => s + i.qty, 0)}
                </b>
              }
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="avatar">KS</div>
          <div>
            <strong>Admin Toko</strong>
            <small>Administrator</small>
          </div>
          <span className="online-dot" />
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <div className="eyebrow">WORKSPACE / {page.toUpperCase()}</div>
            <h1>
              {page === "Ringkasan" ? "Ringkasan Penjualan" :
               page === "Kasir" ? "Kasir Penjualan" :
               page === "Produk" ? "Manajemen Produk" :
               page === "Transaksi" ? "Riwayat Transaksi" :
               "Pengaturan Toko"}
            </h1>
          </div>
          <div className="top-right">
            <span className="date-chip">{today}</span>
            <div className="avatar">KS</div>
          </div>
        </header>

        {notice && (
          <div className={`notice ${notice.includes("berhasil") ? "success" : ""}`}>
            <span>{notice}</span>
            <button onClick={() => setNotice("")}><X size={16} /></button>
          </div>
        )}

        {page === "Kasir" && (
          <div className="pos-layout">
            <section className="catalog-panel">
              <div className="section-head">
                <div>
                  <h2>Pilih Produk</h2>
                  <p>Pilih produk untuk ditambahkan ke keranjang.</p>
                </div>
                <span className="count-pill">{visibleProducts.length} produk</span>
              </div>

              <div className="searchbox">
                <Search size={18} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Cari nama produk atau SKU..."
                />
                {search && <button onClick={() => setSearch("")}><X size={15} /></button>}
              </div>

              <div className="category-list">
                {categories.map(c => (
                  <button
                    key={c}
                    className={category === c ? "selected" : ""}
                    onClick={() => setCategory(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div className="product-grid">
                {visibleProducts.map(p => (
                  <button
                    className="product-card"
                    key={p.id}
                    onClick={() => addToCart(p)}
                    disabled={p.stock <= 0}
                  >
                    <div className="product-visual" style={{ background: p.color }}>
                      <Package size={27} />
                      <span>{p.sku}</span>
                    </div>
                    <div className="product-info">
                      <strong>{p.name}</strong>
                      <small>{p.category} · Stok {p.stock}</small>
                      <b>{rupiah(p.price)}</b>
                    </div>
                    <span className="add-product"><Plus size={17} /></span>
                  </button>
                ))}
                {visibleProducts.length === 0 &&
                  <div className="empty-state">Produk tidak ditemukan.</div>
                }
              </div>
            </section>

            <aside className="cart-panel">
              <div className="cart-head">
                <div>
                  <h2><ShoppingCart size={19} /> Keranjang</h2>
                  <p>{cart.reduce((s, i) => s + i.qty, 0)} item dipilih</p>
                </div>
                <button className="clear-btn" onClick={() => setCart([])} disabled={!cart.length}>
                  <Trash2 size={15} /> Kosongkan
                </button>
              </div>

              <div className="cart-items">
                {cart.length === 0
                  ? <div className="cart-empty">
                      <div className="empty-cart-icon"><ShoppingCart size={27} /></div>
                      <strong>Keranjang masih kosong</strong>
                      <p>Pilih produk dari katalog untuk memulai transaksi.</p>
                    </div>
                  : cart.map(i => (
                      <div className="cart-item" key={i.id}>
                        <div className="item-dot" style={{ background: i.color }}>
                          <Package size={17} />
                        </div>
                        <div className="item-detail">
                          <strong>{i.name}</strong>
                          <small>{rupiah(i.price)} / item</small>
                          <div className="qty-control">
                            <button onClick={() => changeQty(i.id, -1)}><Minus size={13} /></button>
                            <span>{i.qty}</span>
                            <button onClick={() => changeQty(i.id, 1)}><Plus size={13} /></button>
                          </div>
                        </div>
                        <div className="item-total">
                          <b>{rupiah(i.price * i.qty)}</b>
                          <button onClick={() => setCart(old => old.filter(x => x.id !== i.id))}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                }
              </div>

              <div className="checkout-area">
                <div className="adjust-row">
                  <label>Diskon (Rp)</label>
                  <input type="number" min="0" value={discount}
                    onChange={e => setDiscount(e.target.value)} />
                </div>
                <div className="adjust-row">
                  <label>Pajak (%)</label>
                  <input type="number" min="0" max="100" value={taxRate}
                    onChange={e => setTaxRate(e.target.value)} />
                </div>

                <div className="totals">
                  <div><span>Subtotal</span><b>{rupiah(subtotal)}</b></div>
                  <div><span>Diskon</span><b className="discount-value">− {rupiah(discountAmount)}</b></div>
                  <div><span>Pajak</span><b>{rupiah(tax)}</b></div>
                  <div className="grand-total">
                    <strong>Total Pembayaran</strong>
                    <strong>{rupiah(total)}</strong>
                  </div>
                </div>

                <div className="payment-label">METODE PEMBAYARAN</div>

                <div className="payment-methods">
                  {[
                    { name: "Tunai", icon: Banknote },
                    { name: "Transfer", icon: CreditCard },
                    { name: "QRIS", icon: Smartphone }
                  ].map(m => (
                    <button
                      key={m.name}
                      className={payMethod === m.name ? "chosen" : ""}
                      onClick={() => setPayMethod(m.name)}
                    >
                      <m.icon size={17} />
                      {m.name}
                      {payMethod === m.name && <Check size={13} className="pay-check" />}
                    </button>
                  ))}
                </div>

                {payMethod === "Tunai" && (
                  <div className="cash-row">
                    <label>Uang diterima</label>
                    <input type="number" min="0" placeholder="Masukkan nominal"
                      value={cash} onChange={e => setCash(e.target.value)} />
                    <div className="change-row">
                      <span>Kembalian</span>
                      <b>{rupiah(Math.max(0, (Number(cash) || 0) - total))}</b>
                    </div>
                  </div>
                )}

                <button className="checkout-btn" onClick={checkout} disabled={!cart.length}>
                  <span>Proses Pembayaran</span>
                  <span>{rupiah(total)} <span className="arrow">→</span></span>
                </button>
                <small className="secure-note">
                  Transaksi tersimpan pada browser perangkat ini.
                </small>
              </div>
            </aside>
          </div>
        )}

        {page === "Ringkasan" && (
          <div className="page-content">
            <div className="stats-grid">
              <Stat icon={CircleDollarSign} label="Omzet Hari Ini"
                value={rupiah(todayRevenue)} hint="Total penjualan hari ini" />
              <Stat icon={ReceiptText} label="Transaksi Hari Ini"
                value={todaySales.length} hint="Transaksi berhasil" />
              <Stat icon={Boxes} label="Total Produk"
                value={products.length} hint="Produk terdaftar" />
              <Stat icon={TrendingUp} label="Unit Terjual Hari Ini"
                value={todaySales.reduce((s, x) =>
                  s + x.items.reduce((a, i) => a + i.qty, 0), 0)}
                hint="Akumulasi item terjual" />
            </div>

            <div className="content-card">
              <div className="section-head">
                <div><h2>Transaksi Terbaru</h2><p>Aktivitas penjualan terakhir.</p></div>
                <button className="secondary-btn" onClick={() => setPage("Transaksi")}>
                  Lihat semua
                </button>
              </div>
              <SalesTable sales={sales.slice(0, 6)} onPrint={printReceipt} />
            </div>

            <div className="content-card">
              <div className="section-head">
                <div><h2>Stok Menipis</h2><p>Produk dengan stok 5 atau kurang.</p></div>
              </div>
              {products.filter(p => p.stock <= 5).length
                ? products.filter(p => p.stock <= 5).map(p => (
                    <div className="low-stock" key={p.id}>
                      <Package size={17} /><span>{p.name}</span><b>{p.stock} tersisa</b>
                    </div>
                  ))
                : <p className="muted">Belum ada produk dengan stok menipis.</p>
              }
            </div>
          </div>
        )}

        {page === "Produk" && (
          <div className="page-content">
            <div className="content-card">
              <div className="section-head">
                <div><h2>Daftar Produk</h2><p>Kelola katalog, harga jual, dan stok.</p></div>
                <button className="primary-btn" onClick={() => {
                  setEditing(null);
                  setProductForm({
                    name: "", sku: "", category: "Umum", price: "", stock: ""
                  });
                  setModal(true);
                }}>
                  <Plus size={17} /> Tambah Produk
                </button>
              </div>

              <div className="searchbox product-search">
                <Search size={18} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Cari produk..." />
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>PRODUK</th><th>SKU</th><th>KATEGORI</th><th>HARGA</th><th>STOK</th><th>AKSI</th></tr>
                  </thead>
                  <tbody>
                    {visibleProducts.map(p => (
                      <tr key={p.id}>
                        <td><strong>{p.name}</strong></td>
                        <td>{p.sku || "-"}</td>
                        <td><span className="category-badge">{p.category}</span></td>
                        <td><b>{rupiah(p.price)}</b></td>
                        <td><span className={p.stock <= 5 ? "stock-low" : "stock-ok"}>{p.stock}</span></td>
                        <td>
                          <div className="actions">
                            <button onClick={() => openEdit(p)}>Edit</button>
                            <button className="delete-action" onClick={() => {
                              if (confirm(`Hapus produk ${p.name}?`)) {
                                setProducts(old => old.filter(x => x.id !== p.id));
                              }
                            }}>Hapus</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {page === "Transaksi" && (
          <div className="page-content">
            <div className="content-card">
              <div className="section-head">
                <div><h2>Semua Transaksi</h2><p>{sales.length} transaksi tercatat di perangkat ini.</p></div>
                <button className="secondary-btn" onClick={() => {
                  const blob = new Blob([
                    ["ID,Waktu,Metode,Subtotal,Diskon,Pajak,Total"].concat(
                      sales.map(s => [
                        s.id, new Date(s.time).toLocaleString("id-ID"),
                        s.method, s.subtotal, s.discount, s.tax, s.total
                      ].join(","))
                    ).join("\n")
                  ], { type: "text/csv;charset=utf-8;" });

                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = "laporan-transaksi.csv";
                  a.click();
                  URL.revokeObjectURL(a.href);
                }}>Ekspor CSV</button>
              </div>
              <SalesTable sales={sales} onPrint={printReceipt} />
            </div>
          </div>
        )}

        {page === "Pengaturan" && (
          <div className="page-content">
            <div className="content-card settings-card">
              <h2>Pengaturan Dasar</h2>
              <p className="muted">Versi awal Kasir General POS menyimpan data di browser yang digunakan.</p>

              <div className="setting-row">
                <div>
                  <strong>Data produk & transaksi</strong>
                  <p>Data disimpan lokal pada browser ini, bukan database online.</p>
                </div>
                <span className="status-label">Penyimpanan lokal</span>
              </div>

              <div className="setting-row">
                <div>
                  <strong>Contoh data</strong>
                  <p>Tambahkan atau hapus produk melalui menu Produk.</p>
                </div>
                <button className="secondary-btn" onClick={() => {
                  if (confirm("Kembalikan produk contoh? Produk saat ini akan diganti.")) {
                    setProducts(initialProducts);
                    setNotice("Produk contoh berhasil dipulihkan.");
                  }
                }}>Pulihkan produk contoh</button>
              </div>

              <div className="setting-row">
                <div>
                  <strong>Hapus semua transaksi</strong>
                  <p>Riwayat penjualan akan dihapus permanen dari browser ini.</p>
                </div>
                <button className="danger-btn" onClick={() => {
                  if (confirm("Yakin menghapus seluruh riwayat transaksi?")) setSales([]);
                }}>Hapus riwayat</button>
              </div>

              <div className="info-box">
                <strong>Catatan sebelum digunakan untuk bisnis sungguhan</strong>
                <p>Versi ini cocok untuk demo atau kasir satu perangkat. Untuk multi-user, sinkronisasi lintas perangkat, login aman, dan data terpusat, sambungkan database seperti Supabase atau Neon serta autentikasi.</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <form className="product-modal" onSubmit={saveProduct}
            onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>{editing ? "Edit Produk" : "Tambah Produk"}</h2>
                <p>Lengkapi informasi produk di bawah.</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setModal(false)}>
                <X size={19} />
              </button>
            </div>

            <label>Nama produk
              <input required value={productForm.name}
                onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                placeholder="Contoh: Kopi Susu" />
            </label>

            <label>SKU / Kode produk
              <input value={productForm.sku}
                onChange={e => setProductForm({ ...productForm, sku: e.target.value })}
                placeholder="Contoh: KOP-001" />
            </label>

            <label>Kategori
              <input required value={productForm.category}
                onChange={e => setProductForm({ ...productForm, category: e.target.value })}
                placeholder="Contoh: Minuman" />
            </label>

            <div className="form-two">
              <label>Harga jual (Rp)
                <input type="number" min="0" required value={productForm.price}
                  onChange={e => setProductForm({ ...productForm, price: e.target.value })} />
              </label>
              <label>Stok awal
                <input type="number" min="0" required value={productForm.stock}
                  onChange={e => setProductForm({ ...productForm, stock: e.target.value })} />
              </label>
            </div>

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setModal(false)}>Batal</button>
              <button className="primary-btn" type="submit"><Check size={16} /> Simpan Produk</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <div className="stat-icon"><Icon size={19} /></div>
      </div>
      <strong className="stat-value">{value}</strong>
      <small>{hint}</small>
    </div>
  );
}

function SalesTable({ sales, onPrint }) {
  if (!sales.length) {
    return <div className="empty-state">Belum ada transaksi. Mulai transaksi dari menu Kasir.</div>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>ID TRANSAKSI</th><th>TANGGAL</th><th>ITEM</th><th>PEMBAYARAN</th><th>TOTAL</th><th>STRUK</th></tr>
        </thead>
        <tbody>
          {sales.map(s => (
            <tr key={s.id}>
              <td><strong>{s.id}</strong></td>
              <td>{new Date(s.time).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</td>
              <td>{s.items.reduce((a, i) => a + i.qty, 0)} item</td>
              <td><span className="category-badge">{s.method}</span></td>
              <td><b>{rupiah(s.total)}</b></td>
              <td>
                <button className="print-btn" onClick={() => onPrint(s)}>
                  <Printer size={15} /> Cetak
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);

