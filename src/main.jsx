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
  deleteSupabaseProduct,
  fetchSalesByStore,
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
const isDatabaseId = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id || "");

function App() {
  const [preferredStoreId, setPreferredStoreId] = useState(() => read("kg_selected_store", DEFAULT_STORE_ID));
  const [selectedStoreId, setSelectedStoreId] = useState(DEFAULT_STORE_ID);
  const [selectedStoreName, setSelectedStoreName] = useState("Toko Demo");
  const [dataStoreId, setDataStoreId] = useState(DEFAULT_STORE_ID);
  const [products, setProducts] = useState(() => read(storeKey(DEFAULT_STORE_ID, "products"), initialProducts));
  const [sales, setSales] = useState(() => read(storeKey(DEFAULT_STORE_ID, "sales"), []));
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
  const [authInitialized, setAuthInitialized] = useState(!supabase);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [storeDataLoading, setStoreDataLoading] = useState(false);
  const [authForm, setAuthForm] = useState({ email: "", password: "", name: "" });
  const [newStoreName, setNewStoreName] = useState("");
  const [session, setSession] = useState(null);
  const [membershipUserId, setMembershipUserId] = useState(null);
  const [stores, setStores] = useState(() => getDefaultStoreOptions());
  const [schemaInfo, setSchemaInfo] = useState({ ready: false, tables: {}, message: "Memeriksa skema Supabase..." });
  const [syncMessage, setSyncMessage] = useState("Mode lokal");
  const isOnlineStore = Boolean(
    supabase &&
    session &&
    membershipUserId === session.user.id &&
    isDatabaseId(selectedStoreId) &&
    stores.some((store) => store.id === selectedStoreId)
  );
  const canManageProducts = !supabase || (!session
    ? true
    : isOnlineStore && stores.find((store) => store.id === selectedStoreId)?.role === "owner");

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
    if (authInitialized && selectedStoreId) {
      write("kg_selected_store", selectedStoreId);
      write("kg_selected_store_name", selectedStoreName);
    }
  }, [authInitialized, selectedStoreId, selectedStoreName]);

  useEffect(() => {
    let active = true;
    const restoreStoreData = async () => {
      setCart([]);
      if (isOnlineStore) {
        setStoreDataLoading(true);
        setProducts([]);
        setSales([]);
        setSyncMessage("Memuat data online...");
        try {
          const [remoteProducts, remoteSales] = await Promise.all([
            fetchProductsByStore(selectedStoreId),
            fetchSalesByStore(selectedStoreId)
          ]);
          if (!active) return;
          setProducts(remoteProducts);
          setSales(remoteSales);
          setDataStoreId(selectedStoreId);
          setSyncMessage("Tersinkron ke Supabase");
          setStoreDataLoading(false);
        } catch (error) {
          if (!active) return;
          setProducts([]);
          setSales([]);
          setDataStoreId(selectedStoreId);
          setSyncMessage("Gagal memuat data online");
          setNotice(`Gagal memuat data toko dari Supabase: ${error?.message || "Kesalahan tidak diketahui."}`);
          setStoreDataLoading(false);
        }
        return;
      }

      setStoreDataLoading(false);
      if (supabase && session) {
        setProducts([]);
        setSales([]);
        setDataStoreId(selectedStoreId);
        setSyncMessage(membershipUserId === session.user.id
          ? "Belum ada toko online"
          : "Memuat toko online...");
        return;
      }

      const scopedProducts = read(storeKey(selectedStoreId, "products"), initialProducts);
      const scopedSales = read(storeKey(selectedStoreId, "sales"), []);
      setProducts(scopedProducts);
      setSales(scopedSales);
      setDataStoreId(selectedStoreId);
      setSyncMessage(supabase
        ? "Mode lokal — login dan pilih toko online untuk sinkronisasi"
        : "Mode lokal — Supabase belum dikonfigurasi");
    };

    restoreStoreData();
    return () => {
      active = false;
    };
  }, [selectedStoreId, isOnlineStore, membershipUserId, session]);

  useEffect(() => {
    if ((!supabase || !session) && !isOnlineStore && dataStoreId === selectedStoreId) {
      write(storeKey(selectedStoreId, "products"), products);
    }
  }, [products, selectedStoreId, dataStoreId, isOnlineStore, session]);

  useEffect(() => {
    if ((!supabase || !session) && !isOnlineStore && dataStoreId === selectedStoreId) {
      write(storeKey(selectedStoreId, "sales"), sales);
    }
  }, [sales, selectedStoreId, dataStoreId, isOnlineStore, session]);

  useEffect(() => {
    let active = true;
    let subscription;

    const updateSession = async (nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setCart([]);
      if (nextSession) {
        setMembershipUserId(null);
        setStores([]);
        setSelectedStoreId("");
        setSelectedStoreName("Memuat toko...");
        await loadStoreMemberships(nextSession.user.id);
      } else {
        setMembershipUserId(null);
        setStores(getDefaultStoreOptions("Toko Demo"));
        setSelectedStoreId(DEFAULT_STORE_ID);
        setSelectedStoreName("Toko Demo");
      }
      if (active) setAuthInitialized(true);
    };

    const initialize = async () => {
      const result = await getSupabaseDataStatus();
      if (!active) return;
      setSchemaInfo(result);

      if (!supabase) {
        setStores(getDefaultStoreOptions(selectedStoreName));
        setAuthInitialized(true);
        return;
      }

      const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        setTimeout(() => {
          void updateSession(nextSession);
        }, 0);
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

  const loadStoreMemberships = async (userId) => {
    if (!supabase || !userId) return;

    try {
      const memberships = await fetchStoreMemberships(userId);

      if (!memberships.length) {
        setStores([]);
        setSelectedStoreId("");
        setSelectedStoreName("Belum ada toko");
        setMembershipUserId(userId);
        return;
      }

      setStores(memberships);
      setMembershipUserId(userId);

      const savedStoreId = read("kg_selected_store", preferredStoreId);
      const selectedStore = memberships.find((store) => store.id === savedStoreId) || memberships[0];
      setPreferredStoreId(selectedStore.id);
      setSelectedStoreId(selectedStore.id);
      setSelectedStoreName(selectedStore.name);
    } catch (error) {
      setStores([]);
      setMembershipUserId(null);
      setSelectedStoreId("");
      setSelectedStoreName("Toko tidak dapat dimuat");
      setNotice(`Gagal memuat daftar toko: ${error?.message || "Kesalahan tidak diketahui."}`);
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
        setPreferredStoreId(DEFAULT_STORE_ID);
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
            data: { full_name: authForm.name.trim() },
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

    if (!supabase) {
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

    if (!session) {
      setNotice("Login ke Supabase sebelum membuat toko online.");
      return;
    }

    try {
      const createdStore = await createSupabaseStore({ name: cleanName });

      if (!createdStore) {
        throw new Error("Gagal membuat toko. Periksa struktur tabel Supabase Anda.");
      }

      setStoreDataLoading(true);
      setStores((current) => [
        ...current.filter((item) => item.id !== createdStore.id),
        { id: createdStore.id, name: createdStore.name, role: "owner" }
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
    if (!confirm("Apakah Anda yakin ingin keluar dari akun?")) return;

    try {
      if (supabase) {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      }
      setSession(null);
      setMembershipUserId(null);
      setPreferredStoreId(DEFAULT_STORE_ID);
      setSelectedStoreId(DEFAULT_STORE_ID);
      setSelectedStoreName("Toko Demo");
      setStores(getDefaultStoreOptions("Toko Demo"));
      setNotice("Berhasil keluar dari akun.");
    } catch (error) {
      setNotice(`Gagal keluar dari akun: ${error?.message || "Kesalahan tidak diketahui."}`);
    }
  };

  function addToCart(product) {
    if (supabase && session && !isOnlineStore) {
      return setNotice("Pilih toko online sebelum memulai transaksi.");
    }
    if (storeDataLoading) return setNotice("Data toko masih dimuat.");
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

  function saveLocalSale() {
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

    write(storeKey(selectedStoreId, "sales"), nextSales);
    write(storeKey(selectedStoreId, "products"), nextProducts);
    setSales(nextSales);
    setProducts(nextProducts);
    setCart([]);
    setCash("");
    setDiscount("0");
    setNotice("Transaksi berhasil disimpan lokal di browser ini.");
    setTimeout(() => setNotice(""), 3500);
  }

  async function checkout() {
    if (!cart.length) return setNotice("Keranjang masih kosong.");

    if (payMethod === "Tunai" && Number(cash) < total) {
      return setNotice("Uang diterima belum mencukupi.");
    }

    if (!isOnlineStore) {
      if (supabase && session) {
        return setNotice("Pilih toko online atau buat toko terlebih dahulu. Transaksi tidak disimpan lokal untuk akun yang sudah masuk.");
      }
      saveLocalSale();
      return;
    }

    setCheckoutLoading(true);
    try {
      const savedSale = await insertSupabaseSale({
        storeId: selectedStoreId,
        items: cart,
        discount: discountAmount,
        taxRate: Number(taxRate) || 0,
        paymentMethod: payMethod,
        cashReceived: payMethod === "Tunai" ? Number(cash) : total
      });
      setSales((current) => [savedSale, ...current.filter((sale) => sale.databaseId !== savedSale.databaseId)]);
      setProducts((current) => current.map((product) => {
        const sold = cart.find((item) => item.id === product.id);
        return sold ? { ...product, stock: Math.max(0, product.stock - sold.qty) } : product;
      }));
      setCart([]);
      setCash("");
      setDiscount("0");

      try {
        const [remoteProducts, remoteSales] = await Promise.all([
          fetchProductsByStore(selectedStoreId),
          fetchSalesByStore(selectedStoreId)
        ]);
        setProducts(remoteProducts);
        setSales(remoteSales);
        setSyncMessage("Tersinkron ke Supabase");
        setNotice(`Transaksi ${savedSale.id} berhasil tersimpan di Supabase.`);
      } catch (refreshError) {
        setSyncMessage("Transaksi online tersimpan; sinkronisasi ulang diperlukan");
        setNotice(`Transaksi ${savedSale.id} tersimpan online, tetapi data terbaru gagal dimuat: ${refreshError?.message || "kesalahan tidak diketahui."}`);
      }
    } catch (error) {
      setSyncMessage("Checkout online gagal");
      setNotice(`Checkout online gagal dan keranjang dipertahankan. ${error?.message || "Periksa koneksi dan riwayat transaksi sebelum mencoba kembali."}`);
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function saveProduct(event) {
    event.preventDefault();
    if (!canManageProducts) {
      setNotice("Hanya pemilik toko yang dapat mengubah produk.");
      return;
    }

    const item = {
      ...productForm,
      price: Number(productForm.price),
      stock: Number(productForm.stock),
      id: editing ?? Date.now(),
      color: "#e0e7ff"
    };

    if (!item.name.trim() || item.price < 0 || item.stock < 0) return;

    if (isOnlineStore) {
      try {
        const saved = await upsertSupabaseProduct({ ...item, id: editing ?? null }, selectedStoreId);
        setProducts((current) => editing
          ? current.map((product) => product.id === editing ? saved : product)
          : [...current, saved]);
        setSyncMessage("Tersinkron ke Supabase");
        setModal(false);
        setEditing(null);
        setProductForm({ name: "", sku: "", category: "Umum", price: "", stock: "" });
      } catch (error) {
        setNotice(`Produk gagal disimpan ke Supabase: ${error?.message || "Kesalahan tidak diketahui."}`);
      }
      return;
    }

    const nextProducts = editing
      ? products.map((product) => (product.id === editing ? item : product))
      : [...products, item];

    setProducts(nextProducts);

    setModal(false);
    setEditing(null);
    setProductForm({ name: "", sku: "", category: "Umum", price: "", stock: "" });
  }

  async function removeProduct(product) {
    if (!canManageProducts) {
      setNotice("Hanya pemilik toko yang dapat mengubah produk.");
      return;
    }
    if (!confirm(`Hapus produk ${product.name}?`)) return;
    if (isOnlineStore) {
      try {
        await deleteSupabaseProduct(product.id, selectedStoreId);
        setProducts((current) => current.filter((item) => item.id !== product.id));
        setSyncMessage("Tersinkron ke Supabase");
      } catch (error) {
        setNotice(`Produk gagal dihapus dari Supabase: ${error?.message || "Kesalahan tidak diketahui."}`);
      }
      return;
    }
    setProducts((current) => current.filter((item) => item.id !== product.id));
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

  const authFormView = (onCancel) => (
    <form className="product-modal auth-gate-form" onSubmit={handleAuthSubmit} onClick={(event) => event.stopPropagation()}>
      <div className="modal-head">
        <div>
          <h2>{authMode === "login" ? "Masuk" : "Daftar"}</h2>
          <p>{supabase
            ? "Masuk dengan akun Supabase untuk melanjutkan ke aplikasi."
            : "Masuk ke mode demo lokal untuk membuka data demo di browser ini. Data tidak tersinkron."}</p>
        </div>
        {onCancel && (
          <button type="button" className="icon-btn" onClick={onCancel} aria-label="Tutup">
            <X size={19} />
          </button>
        )}
      </div>

      {notice && (
        <div className={`notice ${notice.includes("berhasil") || notice.includes("siap") ? "success" : ""}`}>
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")} aria-label="Tutup pesan">
            <X size={16} />
          </button>
        </div>
      )}

      {authMode === "register" && (
        <label>
          Nama lengkap
          <input
            value={authForm.name}
            onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
            placeholder="Nama pemilik toko"
            required
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
        {onCancel && <button type="button" className="secondary-btn" onClick={onCancel}>Batal</button>}
        <button className="primary-btn" type="submit" disabled={authLoading}>
          {authLoading ? "Memproses..." : authMode === "login" ? "Masuk" : "Daftar"}
        </button>
      </div>
    </form>
  );

  const waitingForStoreMembership = Boolean(supabase && session && membershipUserId !== session.user.id);
  const needsFirstStore = Boolean(supabase && session && membershipUserId === session.user.id && stores.length === 0);

  if (!authInitialized || !session || waitingForStoreMembership) {
    return (
      <div className="auth-gate">
        <div className="auth-gate-content">
          <div className="auth-gate-brand">
            <div className="brand-icon"><ShoppingCart size={21} /></div>
            <div><strong>Kasir<span>POS</span></strong><small>REDAKTOR SAAS</small></div>
          </div>
          {!authInitialized || waitingForStoreMembership ? (
            <div className="content-card auth-gate-status" role="status" aria-live="polite">
              <h1>{session ? "Memuat toko…" : "Memeriksa sesi…"}</h1>
              <p>{session ? "Data toko akun Anda sedang dimuat." : "Sebentar, kami memeriksa sesi masuk Anda."}</p>
              {notice && (
                <div className="notice">
                  <span>{notice}</span>
                  <button type="button" onClick={() => setNotice("")} aria-label="Tutup pesan"><X size={16} /></button>
                </div>
              )}
              {session && notice.startsWith("Gagal memuat daftar toko:") && (
                <button
                  className="secondary-btn auth-gate-logout"
                  onClick={() => {
                    setNotice("");
                    void loadStoreMemberships(session.user.id);
                  }}
                >
                  Coba muat toko lagi
                </button>
              )}
            </div>
          ) : authFormView(null)}
        </div>
      </div>
    );
  }

  if (needsFirstStore) {
    return (
      <div className="auth-gate">
        <div className="auth-gate-content">
          <div className="auth-gate-brand">
            <div className="brand-icon"><ShoppingCart size={21} /></div>
            <div><strong>Kasir<span>POS</span></strong><small>REDAKTOR SAAS</small></div>
          </div>
          <section className="content-card auth-gate-status">
            <h1>Buat toko pertama</h1>
            <p>Akun ini belum memiliki toko. Buat toko untuk mulai menggunakan KasirPOS.</p>
            {notice && (
              <div className={`notice ${notice.includes("berhasil") || notice.includes("siap") ? "success" : ""}`}>
                <span>{notice}</span>
                <button type="button" onClick={() => setNotice("")} aria-label="Tutup pesan"><X size={16} /></button>
              </div>
            )}
            <form className="store-setup-form" onSubmit={handleCreateStore}>
              <label>
                Nama toko
                <input value={newStoreName} onChange={(event) => setNewStoreName(event.target.value)} placeholder="Contoh: Toko Buah Segar" required />
              </label>
              <button className="primary-btn" type="submit" disabled={storeDataLoading}>
                <Plus size={16} /> {storeDataLoading ? "Menyimpan…" : "Buat toko"}
              </button>
            </form>
            <button className="secondary-btn auth-gate-logout" onClick={handleLogout}>
              <LogOut size={16} /> Keluar
            </button>
          </section>
        </div>
      </div>
    );
  }

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
              aria-label={item.name}
              title={item.name}
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
            <span className={`sync-status ${isOnlineStore ? "online" : "local"}`} title={schemaInfo.message}>
              {syncMessage}
            </span>
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
                  <button className="product-card" key={product.id} onClick={() => addToCart(product)} disabled={product.stock <= 0 || storeDataLoading}>
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

                <button
                  className="checkout-btn"
                  onClick={checkout}
                  disabled={
                    !cart.length ||
                    checkoutLoading ||
                    storeDataLoading ||
                    (supabase && (!authInitialized || (session && !isOnlineStore)))
                  }
                >
                  <span>Proses Pembayaran</span>
                  <span>
                    {checkoutLoading ? "Memproses..." : rupiah(total)} <span className="arrow">→</span>
                  </span>
                </button>
                <small className="secure-note">
                  {isOnlineStore
                    ? "Checkout akan menyimpan transaksi, detail, dan pengurangan stok secara atomik di Supabase."
                    : "Mode lokal: transaksi tersimpan hanya di browser ini dan tidak tersinkron ke perangkat lain."}
                </small>
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
                  disabled={!canManageProducts}
                  title={!canManageProducts ? "Hanya pemilik toko yang dapat mengubah produk." : ""}
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
                        <td data-label="Produk">
                          <strong>{product.name}</strong>
                        </td>
                        <td data-label="SKU">{product.sku || "-"}</td>
                        <td data-label="Kategori">
                          <span className="category-badge">{product.category}</span>
                        </td>
                        <td data-label="Harga">
                          <b>{rupiah(product.price)}</b>
                        </td>
                        <td data-label="Stok">
                          <span className={product.stock <= 5 ? "stock-low" : "stock-ok"}>{product.stock}</span>
                        </td>
                        <td data-label="Aksi">
                          <div className="actions">
                            <button disabled={!canManageProducts} onClick={() => openEdit(product)}>Edit</button>
                            <button
                              className="delete-action"
                              disabled={!canManageProducts}
                              onClick={() => removeProduct(product)}
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
                  <p>{sales.length} transaksi {isOnlineStore ? "tersimpan di toko online." : "tersimpan lokal di browser ini."}</p>
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
              <p className="muted">Status penyimpanan saat ini: {syncMessage}.</p>

              <div className="setting-row">
                <div>
                  <strong>Data produk & transaksi</strong>
                  <p>{isOnlineStore ? "Produk dan riwayat transaksi dibaca dari Supabase dengan filter store_id dan RLS." : "Produk dan transaksi saat ini hanya disimpan di browser perangkat ini."} Checkout online memakai RPC atomik untuk menyimpan transaksi, detail, dan perubahan stok sekaligus.</p>
                </div>
                <span className={`status-label ${isOnlineStore ? "online" : "local"}`}>{syncMessage}</span>
              </div>

              <div className="setting-row">
                <div>
                  <strong>Autentikasi & toko</strong>
                  <p>Login, registrasi, membership toko, dan pembuatan toko memakai Supabase saat konfigurasi tersedia; tanpa konfigurasi, aplikasi menggunakan data lokal.</p>
                </div>
                <button className="secondary-btn" onClick={() => setAuthModal(true)}>{session ? "Kelola akun" : "Login / daftar"}</button>
              </div>

              {session && (
                <div className="setting-row">
                  <div>
                    <strong>Keluar dari akun</strong>
                    <p>Keluar dari sesi akun ini tanpa menghapus data produk, transaksi, atau toko.</p>
                  </div>
                  <button className="secondary-btn" onClick={handleLogout}>
                    <LogOut size={16} /> Keluar
                  </button>
                </div>
              )}

              <div className="setting-row">
                <div>
                  <strong>Ganti toko aktif</strong>
                  <p>Data toko online dibatasi oleh membership dan RLS server-side. Data lokal dipisahkan per toko di browser saja.</p>
                </div>
                <button className="secondary-btn" onClick={openStorePicker}>Pilih toko</button>
              </div>

              <div className="info-box">
                <strong>Status sinkronisasi</strong>
                <p>{schemaInfo.message}</p>
              </div>

              <div className="info-box">
                <strong>Checkout online dan migrasi</strong>
                <p>Jalankan migrasi Supabase yang tersedia di repository untuk memasang RPC checkout atomik dan mengizinkan akun membuat lebih dari satu toko. Checkout online memerlukan migrasi tersebut; tanpa koneksi atau konfigurasi, transaksi disimpan lokal saja dan tidak tersinkron.</p>
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
                    setStoreDataLoading(true);
                    setPreferredStoreId(store.id);
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
          {authFormView(() => setAuthModal(false))}
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

