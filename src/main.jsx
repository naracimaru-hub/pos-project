import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ReceiptText,
  Settings,
  Search,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  Smartphone,
  X,
  Check,
  Printer,
  TrendingUp,
  Boxes,
  CircleDollarSign,
  LogOut,
  Store,
  UserRound
} from "lucide-react";
import { supabase } from "./lib/supabase";
import {
  getSupabaseDataStatus,
  fetchStoreMemberships,
  createSupabaseStore,
  fetchProductsByStore,
  upsertSupabaseProduct,
  insertSupabaseSale
} from "./lib/supabase-data";
import "./style.css";

const DEFAULT_STORE_ID = "default-store";

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

const rupiah = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(n || 0);

const read = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // no-op when storage is unavailable
  }
};

const storeKey = (storeId, type) => {
  const normalized = storeId || DEFAULT_STORE_ID;
  return `kg_${type}_${normalized}`;
};

const toStoreName = (name) => (name || "Toko Demo").trim();

const getDefaultStoreOptions = (selectedStoreName = "Toko Demo") => [
  { id: DEFAULT_STORE_ID, name: selectedStoreName }
];

function App() {
  const [selectedStoreId, setSelectedStoreId] = useState(() => read("kg_selected_store", DEFAULT_STORE_ID));
  const [selectedStoreName, setSelectedStoreName] = useState(() => read("kg_selected_store_name", "Toko Demo"));
  const [products, setProducts] = useState(() => read(storeKey(read("kg_selected_store", DEFAULT_STORE_ID), "products"), initialProducts));
  const [sales, setSales] = useState(() => read(storeKey(read("kg_selected_store", DEFAULT_STORE_ID), "sales"), []));
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
  const [authModal, setAuthModal] = useState(false);
  const [storeModal, setStoreModal] = useState(false);
  const [storePicker, setStorePicker] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [authForm, setAuthForm] = useState({ email: "", password: "", name: "" });
  const [newStoreName, setNewStoreName] = useState("");
  const [session, setSession] = useState(null);
  const [stores, setStores] = useState(() => getDefaultStoreOptions());
  const [schemaInfo, setSchemaInfo] = useState({ ready: false, tables: {}, message: "Memeriksa skema Supabase..." });

  const categories = useMemo(() => ["Semua", ...new Set(products.map((p) => p.category))], [products]);
  const visibleProducts = products.filter(
    (p) =>
      (category === "Semua" || p.category === category) &&
      `${p.name} ${p.sku}`.toLowerCase().includes(search.toLowerCase())
  );

  const today = new Date().toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });

  const todaySales = sales.filter(
    (sale) => new Date(sale.time).toDateString() === new Date().toDateString()
  );

  const todayRevenue = todaySales.reduce((total, sale) => total + sale.total, 0);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discountAmount = Math.min(subtotal, Math.max(0, Number(discount) || 0));
  const tax = Math.round(((subtotal - discountAmount) * Math.max(0, Number(taxRate) || 0)) / 100);
  const total = subtotal - discountAmount + tax;

  useEffect(() => {
    write("kg_selected_store", selectedStoreId);
    write("kg_selected_store_name", selectedStoreName);
  }, [selectedStoreId, selectedStoreName]);

  useEffect(() => {
    const restoreLocalData = async () => {
      const scopedProducts = read(storeKey(selectedStoreId, "products"), initialProducts);
      const scopedSales = read(storeKey(selectedStoreId, "sales"), []);
      setProducts(scopedProducts);
      setSales(scopedSales);
      setCart([]);

      if (supabase && selectedStoreId && schemaInfo.ready) {
        const remoteProducts = await fetchProductsByStore(selectedStoreId);
        if (remoteProducts.length) {
          setProducts(remoteProducts);
        }
      }
    };

    restoreLocalData();
  }, [selectedStoreId, schemaInfo.ready]);

  useEffect(() => {
    write(storeKey(selectedStoreId, "products"), products);
  }, [products, selectedStoreId]);

  useEffect(() => {
    write(storeKey(selectedStoreId, "sales"), sales);
  }, [sales, selectedStoreId]);

  useEffect(() => {
    let active = true;
    let subscription;

    const updateSession = async (nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (nextSession) {
        await loadStoreMemberships(nextSession.user.id, nextSession.user.email);
      } else {
        setStores(getDefaultStoreOptions(selectedStoreName));
      }
    };

    const initialize = async () => {
      const result = await getSupabaseDataStatus();
      if (!active) return;
      setSchemaInfo(result);

      if (!supabase) {
        setStores(getDefaultStoreOptions(selectedStoreName));
        return;
      }

      const { data } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
        await updateSession(nextSession);
      });
      subscription = data.subscription;

      const { data: sessionData } = await supabase.auth.getSession();
      await updateSession(sessionData.session);
    };

    initialize();

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  const loadStoreMemberships = async (userId, userEmail) => {
    if (!supabase || !userId) return;

    try {
      const memberships = await fetchStoreMemberships(userId);

      if (!memberships.length) {
        setStores([{ id: DEFAULT_STORE_ID, name: userEmail ? `${userEmail.split("@", 1)[0]} Store` : "Toko Demo" }]);
        setSelectedStoreId(DEFAULT_STORE_ID);
        setSelectedStoreName("Toko Demo");
        return;
      }

      setStores(memberships);

      if (!memberships.some((store) => store.id === selectedStoreId)) {
        setSelectedStoreId(memberships[0].id);
        setSelectedStoreName(memberships[0].name);
      }
    } catch {
      setStores(getDefaultStoreOptions(selectedStoreName));
    }
  };

  const openStorePicker = () => {
    setStorePicker(true);
    setNotice("");
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthLoading(true);

    try {
      if (!supabase) {
        setSession({ user: { email: authForm.email.trim() || "demo@kasirpos.local" } });
        setAuthModal(false);
        setNotice(authMode === "login" ? "Login demo berhasil." : "Registrasi demo berhasil.");
        setAuthForm({ email: "", password: "", name: "" });
        setStores([{ id: DEFAULT_STORE_ID, name: "Toko Demo" }]);
        setSelectedStoreId(DEFAULT_STORE_ID);
        setSelectedStoreName("Toko Demo");
        return;
      }

      const payload = {
        email: authForm.email.trim(),
        password: authForm.password
      };

      if (authMode === "login") {
        const { error } = await supabase.auth.signInWithPassword(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          ...payload,
          options: {
            emailRedirectTo: window.location.origin
          }
        });
        if (error) throw error;
      }

      setAuthModal(false);
      setNotice(authMode === "login" ? "Login berhasil." : "Registrasi berhasil. Silakan cek email Anda.");
      setAuthForm({ email: "", password: "", name: "" });
    } catch (error) {
      setNotice(error?.message || "Autentikasi gagal.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCreateStore = async (event) => {
    event.preventDefault();
    const cleanName = toStoreName(newStoreName);

    if (!cleanName) return setNotice("Nama toko tidak boleh kosong.");

    if (!supabase || !session || !schemaInfo.ready) {
      const nextStoreId = `store-${Date.now()}`;
      const nextStore = { id: nextStoreId, name: cleanName };
      setStores((current) => {
        const existing = current.filter((store) => store.id !== DEFAULT_STORE_ID);
        return [...existing, nextStore];
      });
      setSelectedStoreId(nextStoreId);
      setSelectedStoreName(cleanName);
      setStoreModal(false);
      setNewStoreName("");
      setNotice("Toko baru berhasil dibuat di mode lokal.");
      return;
    }

    try {
      const createdStore = await createSupabaseStore({ userId: session.user.id, name: cleanName });

      if (!createdStore) {
        throw new Error("Gagal membuat toko. Periksa struktur tabel Supabase Anda.");
      }

      setStores((current) => [
        ...current.filter((item) => item.id !== createdStore.id),
        { id: createdStore.id, name: createdStore.name }
      ]);
      setSelectedStoreId(createdStore.id);
      setSelectedStoreName(createdStore.name);
      setStoreModal(false);
      setNewStoreName("");
      setNotice(`Toko "${createdStore.name}" siap dipakai.`);
    } catch (error) {
      setNotice(error?.message || "Gagal membuat toko. Periksa struktur tabel Supabase Anda.");
    }
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setSession(null);
    setSelectedStoreId(DEFAULT_STORE_ID);
    setSelectedStoreName("Toko Demo");
    setStores(getDefaultStoreOptions("Toko Demo"));
    setNotice("Berhasil keluar dari akun.");
  };

  function addToCart(product) {
    if (product.stock <= 0) return setNotice("Stok produk habis.");

    setCart((previousCart) => {
      const found = previousCart.find((item) => item.id === product.id);
      if (found) {
        return previousCart.map((item) =>
          item.id === product.id ? { ...item, qty: Math.min(item.qty + 1, product.stock) } : item
        );
      }
      return [...previousCart, { ...product, qty: 1 }];
    });

    setNotice("");
  }

  function changeQty(id, delta) {
    setCart((previousCart) =>
      previousCart.map((item) =>
        item.id === id
          ? {
              ...item,
              qty: Math.max(
                1,
                Math.min(item.qty + delta, products.find((product) => product.id === id)?.stock ?? item.qty)
              )
            }
          : item
      )
    );
  }

  async function checkout() {
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
      change: payMethod === "Tunai" ? Number(cash) - total : 0,
      store_id: selectedStoreId
    };

    const nextSales = [sale, ...sales];
    const nextProducts = products.map((product) => {
      const item = cart.find((entry) => entry.id === product.id);
      return item ? { ...product, stock: Math.max(0, product.stock - item.qty) } : product;
    });

    setSales(nextSales);
    setProducts(nextProducts);

    if (supabase && selectedStoreId && schemaInfo.ready) {
      const synced = await insertSupabaseSale({ ...sale, store_id: selectedStoreId });
      if (!synced) {
        setNotice("Transaksi disimpan lokal, tetapi sinkronisasi Supabase gagal. Periksa skema tabel sales.");
      }
    }

    setCart([]);
    setCash("");
    setDiscount("0");
    setNotice("Transaksi berhasil disimpan.");
    setTimeout(() => setNotice(""), 3500);
  }

  async function saveProduct(event) {
    event.preventDefault();

    const item = {
      ...productForm,
      price: Number(productForm.price),
      stock: Number(productForm.stock),
      id: editing ?? Date.now(),
      color: "#e0e7ff"
    };

    if (!item.name.trim() || item.price < 0 || item.stock < 0) return;

    const nextProducts = editing
      ? products.map((product) => (product.id === editing ? item : product))
      : [...products, item];

    setProducts(nextProducts);

    if (supabase && selectedStoreId && schemaInfo.ready) {
      const synced = await upsertSupabaseProduct({ ...item, id: editing ?? null }, selectedStoreId);
      if (!synced) {
        setNotice("Produk disimpan lokal, tetapi sinkronisasi Supabase gagal. Periksa skema tabel produk.");
      }
    }

    setModal(false);
    setEditing(null);
    setProductForm({ name: "", sku: "", category: "Umum", price: "", stock: "" });
  }

  function openEdit(product) {
    setEditing(product.id);
    setProductForm({
      name: product.name,
      sku: product.sku,
      category: product.category,
      price: String(product.price),
      stock: String(product.stock)
    });
    setModal(true);
  }

  function printReceipt(sale) {
    const w = window.open("", "_blank", "width=420,height=650");

    if (!w) return setNotice("Izinkan popup untuk mencetak struk.");

    w.document.write(`
      <html>
      <head>
        <title>Struk ${sale.id}</title>
        <style>
          body { font: 13px monospace; padding: 20px; }
          h2, p { text-align: center; }
          .line { border-top: 1px dashed #555; margin: 12px 0; }
          .row { display: flex; justify-content: space-between; margin: 7px 0; }
        </style>
      </head>
      <body>
        <h2>KASIR POS</h2>
        <p>Struk Pembelian</p>
        <div class="line"></div>
        <p>${sale.id}<br>${new Date(sale.time).toLocaleString("id-ID")}</p>
        <div class="line"></div>
        ${sale.items.map((item) => `
          <div>
            ${item.name}
            <div class="row">
              <span>${item.qty} x ${rupiah(item.price)}</span>
              <b>${rupiah(item.qty * item.price)}</b>
            </div>
          </div>
        `).join("")}
        <div class="line"></div>
        <div class="row"><span>Subtotal</span><b>${rupiah(sale.subtotal)}</b></div>
        <div class="row"><span>Diskon</span><b>${rupiah(sale.discount)}</b></div>
        <div class="row"><span>Pajak</span><b>${rupiah(sale.tax)}</b></div>
        <div class="row"><b>Total</b><b>${rupiah(sale.total)}</b></div>
        <div class="row"><span>Metode</span><b>${sale.method}</b></div>
        <div class="row"><span>Kembalian</span><b>${rupiah(sale.change)}</b></div>
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

  const [productForm, setProductForm] = useState({ name: "", sku: "", category: "Umum", price: "", stock: "" });
  const [editing, setEditing] = useState(null);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <ShoppingCart size={21} />
          </div>
          <div>
            <strong>
              Kasir<span>POS</span>
            </strong>
            <small>REDAKTOR SaaS</small>
          </div>
        </div>

        <div className="store-label">MENU</div>

        <nav>
          {nav.map((item) => (
            <button
              key={item.name}
              className={`nav-item ${page === item.name ? "active" : ""}`}
              onClick={() => {
                setPage(item.name);
                setNotice("");
              }}
            >
              <item.icon size={18} />
              <span>{item.name}</span>
              {item.name === "Kasir" && cart.length > 0 && (
                <b className="nav-count">{cart.reduce((sum, entry) => sum + entry.qty, 0)}</b>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="account-box">
            <div className="store-pill">
              <div className="avatar">{(session?.user?.email || "KS").slice(0, 2).toUpperCase()}</div>
              <div className="store-meta">
                <strong>{session?.user?.email ? session.user.email.split("@", 1)[0] : "Admin Toko"}</strong>
                <small>{selectedStoreName}</small>
              </div>
            </div>
            <div className="context-actions">
              <button className="secondary-btn compact" onClick={openStorePicker}>
                <Store size={15} /> Toko
              </button>
              {session ? (
                <button className="secondary-btn compact" onClick={handleLogout}>
                  <LogOut size={15} /> Keluar
                </button>
              ) : (
                <button className="secondary-btn compact" onClick={() => setAuthModal(true)}>
                  <UserRound size={15} /> Login
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <div className="eyebrow">WORKSPACE / {page.toUpperCase()}</div>
            <h1>
              {page === "Ringkasan"
                ? "Ringkasan Penjualan"
                : page === "Kasir"
                ? "Kasir Penjualan"
                : page === "Produk"
                ? "Manajemen Produk"
                : page === "Transaksi"
                ? "Riwayat Transaksi"
                : "Pengaturan Toko"}
            </h1>
          </div>
          <div className="top-right">
            <span className="date-chip">{today}</span>
            <span className="store-chip">{selectedStoreName}</span>
            <div className="avatar">{(selectedStoreName || "KS").slice(0, 2).toUpperCase()}</div>
          </div>
        </header>

        {notice && (
          <div className={`notice ${notice.includes("berhasil") || notice.includes("siap") ? "success" : ""}`}>
            <span>{notice}</span>
            <button onClick={() => setNotice("")}>
              <X size={16} />
            </button>
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
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama produk atau SKU..." />
                {search && (
                  <button onClick={() => setSearch("")}>
                    <X size={15} />
                  </button>
                )}
              </div>

              <div className="category-list">
                {categories.map((item) => (
                  <button key={item} className={category === item ? "selected" : ""} onClick={() => setCategory(item)}>
                    {item}
                  </button>
                ))}
              </div>

              <div className="product-grid">
                {visibleProducts.map((product) => (
                  <button className="product-card" key={product.id} onClick={() => addToCart(product)} disabled={product.stock <= 0}>
                    <div className="product-visual" style={{ background: product.color }}>
                      <Package size={27} />
                      <span>{product.sku}</span>
                    </div>
                    <div className="product-info">
                      <strong>{product.name}</strong>
                      <small>{product.category} · Stok {product.stock}</small>
                      <b>{rupiah(product.price)}</b>
                    </div>
                    <span className="add-product">
                      <Plus size={17} />
                    </span>
                  </button>
                ))}
                {visibleProducts.length === 0 && <div className="empty-state">Produk tidak ditemukan.</div>}
              </div>
            </section>

            <aside className="cart-panel">
              <div className="cart-head">
                <div>
                  <h2>
                    <ShoppingCart size={19} /> Keranjang
                  </h2>
                  <p>{cart.reduce((sum, item) => sum + item.qty, 0)} item dipilih</p>
                </div>
                <button className="clear-btn" onClick={() => setCart([])} disabled={!cart.length}>
                  <Trash2 size={15} /> Kosongkan
                </button>
              </div>

              <div className="cart-items">
                {cart.length === 0 ? (
                  <div className="cart-empty">
                    <div className="empty-cart-icon">
                      <ShoppingCart size={27} />
                    </div>
                    <strong>Keranjang masih kosong</strong>
                    <p>Pilih produk dari katalog untuk memulai transaksi.</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div className="cart-item" key={item.id}>
                      <div className="item-dot" style={{ background: item.color }}>
                        <Package size={17} />
                      </div>
                      <div className="item-detail">
                        <strong>{item.name}</strong>
                        <small>{rupiah(item.price)} / item</small>
                        <div className="qty-control">
                          <button onClick={() => changeQty(item.id, -1)}>
                            <Minus size={13} />
                          </button>
                          <span>{item.qty}</span>
                          <button onClick={() => changeQty(item.id, 1)}>
                            <Plus size={13} />
                          </button>
                        </div>
                      </div>
                      <div className="item-total">
                        <b>{rupiah(item.price * item.qty)}</b>
                        <button onClick={() => setCart((previousCart) => previousCart.filter((entry) => entry.id !== item.id))}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="checkout-area">
                <div className="adjust-row">
                  <label>Diskon (Rp)</label>
                  <input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} />
                </div>
                <div className="adjust-row">
                  <label>Pajak (%)</label>
                  <input type="number" min="0" max="100" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
                </div>

                <div className="totals">
                  <div>
                    <span>Subtotal</span>
                    <b>{rupiah(subtotal)}</b>
                  </div>
                  <div>
                    <span>Diskon</span>
                    <b className="discount-value">− {rupiah(discountAmount)}</b>
                  </div>
                  <div>
                    <span>Pajak</span>
                    <b>{rupiah(tax)}</b>
                  </div>
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
                  ].map((method) => (
                    <button key={method.name} className={payMethod === method.name ? "chosen" : ""} onClick={() => setPayMethod(method.name)}>
                      <method.icon size={17} />
                      {method.name}
                      {payMethod === method.name && <Check size={13} className="pay-check" />}
                    </button>
                  ))}
                </div>

                {payMethod === "Tunai" && (
                  <div className="cash-row">
                    <label>Uang diterima</label>
                    <input type="number" min="0" placeholder="Masukkan nominal" value={cash} onChange={(e) => setCash(e.target.value)} />
                    <div className="change-row">
                      <span>Kembalian</span>
                      <b>{rupiah(Math.max(0, (Number(cash) || 0) - total))}</b>
                    </div>
                  </div>
                )}

                <button className="checkout-btn" onClick={checkout} disabled={!cart.length}>
                  <span>Proses Pembayaran</span>
                  <span>
                    {rupiah(total)} <span className="arrow">→</span>
                  </span>
                </button>
                <small className="secure-note">Transaksi tersimpan pada browser perangkat ini lalu dapat disinkronkan ke Supabase jika tabel sudah tersedia.</small>
              </div>
            </aside>
          </div>
        )}

        {page === "Ringkasan" && (
          <div className="page-content">
            <div className="stats-grid">
              <Stat icon={CircleDollarSign} label="Omzet Hari Ini" value={rupiah(todayRevenue)} hint="Total penjualan hari ini" />
              <Stat icon={ReceiptText} label="Transaksi Hari Ini" value={todaySales.length} hint="Transaksi berhasil" />
              <Stat icon={Boxes} label="Total Produk" value={products.length} hint="Produk terdaftar" />
              <Stat
                icon={TrendingUp}
                label="Unit Terjual Hari Ini"
                value={todaySales.reduce((sum, sale) => sum + sale.items.reduce((inner, item) => inner + item.qty, 0), 0)}
                hint="Akumulasi item terjual"
              />
            </div>

            <div className="content-card">
              <div className="section-head">
                <div>
                  <h2>Transaksi Terbaru</h2>
                  <p>Aktivitas penjualan terakhir.</p>
                </div>
                <button className="secondary-btn" onClick={() => setPage("Transaksi")}>Lihat semua</button>
              </div>
              <SalesTable sales={sales.slice(0, 6)} onPrint={printReceipt} />
            </div>

            <div className="content-card">
              <div className="section-head">
                <div>
                  <h2>Stok Menipis</h2>
                  <p>Produk dengan stok 5 atau kurang.</p>
                </div>
              </div>
              {products.filter((item) => item.stock <= 5).length ? (
                products.filter((item) => item.stock <= 5).map((item) => (
                  <div className="low-stock" key={item.id}>
                    <Package size={17} />
                    <span>{item.name}</span>
                    <b>{item.stock} tersisa</b>
                  </div>
                ))
              ) : (
                <p className="muted">Belum ada produk dengan stok menipis.</p>
              )}
            </div>
          </div>
        )}

        {page === "Produk" && (
          <div className="page-content">
            <div className="content-card">
              <div className="section-head">
                <div>
                  <h2>Daftar Produk</h2>
                  <p>Kelola katalog, harga jual, dan stok.</p>
                </div>
                <button
                  className="primary-btn"
                  onClick={() => {
                    setEditing(null);
                    setProductForm({ name: "", sku: "", category: "Umum", price: "", stock: "" });
                    setModal(true);
                  }}
                >
                  <Plus size={17} /> Tambah Produk
                </button>
              </div>

              <div className="searchbox product-search">
                <Search size={18} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari produk..." />
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>PRODUK</th>
                      <th>SKU</th>
                      <th>KATEGORI</th>
                      <th>HARGA</th>
                      <th>STOK</th>
                      <th>AKSI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleProducts.map((product) => (
                      <tr key={product.id}>
                        <td>
                          <strong>{product.name}</strong>
                        </td>
                        <td>{product.sku || "-"}</td>
                        <td>
                          <span className="category-badge">{product.category}</span>
                        </td>
                        <td>
                          <b>{rupiah(product.price)}</b>
                        </td>
                        <td>
                          <span className={product.stock <= 5 ? "stock-low" : "stock-ok"}>{product.stock}</span>
                        </td>
                        <td>
                          <div className="actions">
                            <button onClick={() => openEdit(product)}>Edit</button>
                            <button
                              className="delete-action"
                              onClick={() => {
                                if (confirm(`Hapus produk ${product.name}?`)) {
                                  setProducts((previousProducts) => previousProducts.filter((item) => item.id !== product.id));
                                }
                              }}
                            >
                              Hapus
                            </button>
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
                <div>
                  <h2>Semua Transaksi</h2>
                  <p>{sales.length} transaksi tercatat di perangkat ini.</p>
                </div>
                <button
                  className="secondary-btn"
                  onClick={() => {
                    const blob = new Blob(
                      [
                        ["ID,Waktu,Metode,Subtotal,Diskon,Pajak,Total"].concat(
                          sales.map((sale) =>
                            [
                              sale.id,
                              new Date(sale.time).toLocaleString("id-ID"),
                              sale.method,
                              sale.subtotal,
                              sale.discount,
                              sale.tax,
                              sale.total
                            ].join(","))
                        )
                      ].join("\n"),
                      { type: "text/csv;charset=utf-8;" }
                    );

                    const link = document.createElement("a");
                    link.href = URL.createObjectURL(blob);
                    link.download = "laporan-transaksi.csv";
                    link.click();
                    URL.revokeObjectURL(link.href);
                  }}
                >
                  Ekspor CSV
                </button>
              </div>
              <SalesTable sales={sales} onPrint={printReceipt} />
            </div>
          </div>
        )}

        {page === "Pengaturan" && (
          <div className="page-content">
            <div className="content-card settings-card">
              <h2>Pengaturan Dasar</h2>
              <p className="muted">Data saat ini difokuskan per toko dan tetap memiliki fallback lokal agar tidak menggagalkan operasi kasir.</p>

              <div className="setting-row">
                <div>
                  <strong>Data produk & transaksi</strong>
                  <p>Produk dan transaksi disimpan terpisah di browser. Akses database online tetap nonaktif sampai skema dan kebijakan RLS diverifikasi.</p>
                </div>
                <span className="status-label">Penyimpanan lokal per toko</span>
              </div>

              <div className="setting-row">
                <div>
                  <strong>Autentikasi & toko</strong>
                  <p>Login dan registrasi dapat memakai Supabase. Pembuatan toko disimpan lokal sampai skema database dan RLS terverifikasi.</p>
                </div>
                <button className="secondary-btn" onClick={() => setAuthModal(true)}>{session ? "Kelola akun" : "Login / daftar"}</button>
              </div>

              <div className="setting-row">
                <div>
                  <strong>Ganti toko aktif</strong>
                  <p>Pemilihan toko memisahkan data lokal di browser, tetapi bukan pengganti pembatasan akses server-side melalui RLS.</p>
                </div>
                <button className="secondary-btn" onClick={openStorePicker}>Pilih toko</button>
              </div>

              <div className="info-box">
                <strong>Status skema Supabase</strong>
                <p>{schemaInfo.message}</p>
              </div>

              <div className="info-box">
                <strong>Catatan penting</strong>
                <p>Integrasi baik dengan Supabase maupun fallback lokal tetap bersifat aman. Karena repo ini tidak menyertakan skema database yang hidup di server, tabel dan RLS harus diperiksa terlebih dahulu di proyek Supabase yang sebenarnya sebelum mengaktifkan sinkronisasi penuh.</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {storePicker && (
        <div className="modal-backdrop" onClick={() => setStorePicker(false)}>
          <div className="product-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>Pilih Toko</h2>
                <p>Setiap toko memiliki data yang terpisah.</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setStorePicker(false)}>
                <X size={19} />
              </button>
            </div>

            <div className="store-list">
              {stores.map((store) => (
                <button
                  key={store.id}
                  className={`store-item ${selectedStoreId === store.id ? "selected-store" : ""}`}
                  onClick={() => {
                    setSelectedStoreId(store.id);
                    setSelectedStoreName(store.name);
                    setStorePicker(false);
                  }}
                >
                  <Store size={17} />
                  <span>{store.name}</span>
                </button>
              ))}
            </div>

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setStorePicker(false)}>Batal</button>
              <button type="button" className="primary-btn" onClick={() => {
                setStorePicker(false);
                setStoreModal(true);
              }}>
                <Plus size={16} /> Buat toko baru
              </button>
            </div>
          </div>
        </div>
      )}

      {authModal && (
        <div className="modal-backdrop" onClick={() => setAuthModal(false)}>
          <form className="product-modal" onSubmit={handleAuthSubmit} onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>{authMode === "login" ? "Masuk" : "Daftar"}</h2>
                <p>Gunakan akun Supabase yang sudah ada atau demo local.</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setAuthModal(false)}>
                <X size={19} />
              </button>
            </div>

            {authMode === "register" && (
              <label>
                Nama lengkap
                <input
                  value={authForm.name}
                  onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
                  placeholder="Nama pemilik toko"
                />
              </label>
            )}

            <label>
              Email
              <input
                type="email"
                required
                value={authForm.email}
                onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
                placeholder="contoh@email.com"
              />
            </label>

            <label>
              Password
              <input
                type="password"
                required
                minLength="6"
                value={authForm.password}
                onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                placeholder="Minimal 6 karakter"
              />
            </label>

            <div className="auth-toggle-row">
              <button type="button" className="text-button" onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}>
                {authMode === "login" ? "Belum punya akun? Daftar" : "Sudah punya akun? Masuk"}
              </button>
            </div>

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setAuthModal(false)}>Batal</button>
              <button className="primary-btn" type="submit" disabled={authLoading}>
                {authLoading ? "Memproses..." : authMode === "login" ? "Masuk" : "Daftar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {storeModal && (
        <div className="modal-backdrop" onClick={() => setStoreModal(false)}>
          <form className="product-modal" onSubmit={handleCreateStore} onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>Buat Toko Baru</h2>
                <p>Masukkan nama toko yang akan dijadikan unit bisnis.</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setStoreModal(false)}>
                <X size={19} />
              </button>
            </div>

            <label>
              Nama toko
              <input value={newStoreName} onChange={(event) => setNewStoreName(event.target.value)} placeholder="Contoh: Toko Buah Segar" required />
            </label>

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setStoreModal(false)}>Batal</button>
              <button className="primary-btn" type="submit">
                <Check size={16} /> Simpan Toko
              </button>
            </div>
          </form>
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <form className="product-modal" onSubmit={saveProduct} onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>{editing ? "Edit Produk" : "Tambah Produk"}</h2>
                <p>Lengkapi informasi produk di bawah.</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setModal(false)}>
                <X size={19} />
              </button>
            </div>

            <label>
              Nama produk
              <input required value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} placeholder="Contoh: Kopi Susu" />
            </label>

            <label>
              SKU / Kode produk
              <input value={productForm.sku} onChange={(event) => setProductForm({ ...productForm, sku: event.target.value })} placeholder="Contoh: KOP-001" />
            </label>

            <label>
              Kategori
              <input required value={productForm.category} onChange={(event) => setProductForm({ ...productForm, category: event.target.value })} placeholder="Contoh: Minuman" />
            </label>

            <div className="form-two">
              <label>
                Harga jual (Rp)
                <input type="number" min="0" required value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} />
              </label>
              <label>
                Stok awal
                <input type="number" min="0" required value={productForm.stock} onChange={(event) => setProductForm({ ...productForm, stock: event.target.value })} />
              </label>
            </div>

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setModal(false)}>Batal</button>
              <button className="primary-btn" type="submit">
                <Check size={16} /> Simpan Produk
              </button>
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
        <div className="stat-icon">
          <Icon size={19} />
        </div>
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
          <tr>
            <th>ID TRANSAKSI</th>
            <th>TANGGAL</th>
            <th>ITEM</th>
            <th>PEMBAYARAN</th>
            <th>TOTAL</th>
            <th>STRUK</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => (
            <tr key={sale.id}>
              <td>
                <strong>{sale.id}</strong>
              </td>
              <td>{new Date(sale.time).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</td>
              <td>{sale.items.reduce((sum, item) => sum + item.qty, 0)} item</td>
              <td>
                <span className="category-badge">{sale.method}</span>
              </td>
              <td>
                <b>{rupiah(sale.total)}</b>
              </td>
              <td>
                <button className="print-btn" onClick={() => onPrint(sale)}>
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
