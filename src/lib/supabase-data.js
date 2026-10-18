import { supabase } from "./supabase";

const requireSupabase = () => {
  if (!supabase) {
    throw new Error("Supabase belum dikonfigurasi.");
  }
  return supabase;
};

const throwIfError = ({ data, error }) => {
  if (error) throw error;
  return data;
};

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || "");

const requireUuid = (value, label) => {
  if (!isUuid(value)) {
    throw new Error(`${label} tidak valid untuk toko Supabase.`);
  }
};

const mapProduct = (product) => ({
  ...product,
  category: product.category || "Umum",
  color: product.color || "#e0e7ff"
});

const mapSale = (sale, items = []) => ({
  id: sale.receipt_number,
  databaseId: sale.id,
  time: sale.created_at,
  items: items.map((item) => ({
    id: item.product_id,
    name: item.product_name,
    sku: item.sku || "",
    qty: item.quantity,
    price: item.unit_price,
    lineTotal: item.line_total
  })),
  subtotal: sale.subtotal,
  discount: sale.discount,
  tax: sale.tax,
  total: sale.total,
  method: sale.payment_method,
  cash: sale.cash_received,
  change: sale.change_amount
});

export async function getSupabaseDataStatus() {
  if (!supabase) {
    return {
      ready: false,
      tables: {},
      message: "Mode lokal: Supabase belum dikonfigurasi. Set VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY."
    };
  }

  try {
    const { error } = await supabase.from("stores").select("id", { head: true }).limit(1);
    if (error) {
      return {
        ready: false,
        tables: {},
        message: `Supabase belum dapat diakses: ${error.message}`
      };
    }
  } catch (error) {
    return {
      ready: false,
      tables: {},
      message: `Pemeriksaan koneksi Supabase gagal: ${error?.message || "kesalahan tidak diketahui."}`
    };
  }

  return {
    ready: true,
    tables: {},
    message: "Supabase terhubung. Checkout online membutuhkan migrasi checkout atomik di supabase/migrations; RLS tetap membatasi akses data toko."
  };
}

export async function fetchStoreMemberships(userId) {
  const client = requireSupabase();
  const memberships = throwIfError(await client
    .from("store_members")
    .select("store_id, role")
    .eq("user_id", userId));

  if (!memberships.length) return [];

  const stores = throwIfError(await client
    .from("stores")
    .select("id, name")
    .in("id", memberships.map((membership) => membership.store_id)));
  const roles = new Map(memberships.map((membership) => [membership.store_id, membership.role]));

  return stores.map((store) => ({ ...store, role: roles.get(store.id) }));
}

export async function createSupabaseStore({ name }) {
  const client = requireSupabase();
  const result = await client.rpc("create_store", { p_name: name });
  const data = throwIfError(result);
  const store = Array.isArray(data) ? data[0] : data;
  if (!store?.id || !store?.name) {
    throw new Error("RPC create_store tidak mengembalikan record toko yang valid.");
  }
  return { id: store.id, name: store.name };
}

export async function fetchProductsByStore(storeId) {
  requireUuid(storeId, "ID toko");
  const client = requireSupabase();
  const products = throwIfError(await client
    .from("products")
    .select("id, store_id, name, sku, category, price, stock, color, created_at, updated_at")
    .eq("store_id", storeId)
    .order("name"));
  return products.map(mapProduct);
}

export async function fetchSalesByStore(storeId) {
  requireUuid(storeId, "ID toko");
  const client = requireSupabase();
  const sales = throwIfError(await client
    .from("sales")
    .select("id, store_id, receipt_number, cashier_id, subtotal, discount, tax, total, payment_method, cash_received, change_amount, created_at")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false }));
  if (!sales.length) return [];

  const items = throwIfError(await client
    .from("sale_items")
    .select("sale_id, product_id, product_name, sku, quantity, unit_price, line_total")
    .eq("store_id", storeId)
    .in("sale_id", sales.map((sale) => sale.id)));
  const itemsBySale = new Map();
  for (const item of items) {
    const group = itemsBySale.get(item.sale_id) || [];
    group.push(item);
    itemsBySale.set(item.sale_id, group);
  }
  return sales.map((sale) => mapSale(sale, itemsBySale.get(sale.id)));
}

export async function upsertSupabaseProduct(product, storeId) {
  requireUuid(storeId, "ID toko");
  if (product.id) requireUuid(product.id, "ID produk");
  const client = requireSupabase();
  const values = {
    store_id: storeId,
    name: product.name.trim(),
    sku: product.sku.trim(),
    category: product.category.trim(),
    price: product.price,
    stock: product.stock,
    color: product.color || "#e0e7ff"
  };

  if (product.id) {
    const updated = throwIfError(await client
      .from("products")
      .update(values)
      .eq("id", product.id)
      .eq("store_id", storeId)
      .select("id, store_id, name, sku, category, price, stock, color, created_at, updated_at")
      .single());
    return mapProduct(updated);
  }

  const inserted = throwIfError(await client
    .from("products")
    .insert(values)
    .select("id, store_id, name, sku, category, price, stock, color, created_at, updated_at")
    .single());
  return mapProduct(inserted);
}

export async function deleteSupabaseProduct(productId, storeId) {
  requireUuid(storeId, "ID toko");
  requireUuid(productId, "ID produk");
  const client = requireSupabase();
  throwIfError(await client
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("store_id", storeId)
    .select("id")
    .single());
}

export async function insertSupabaseSale({ storeId, items, discount, taxRate, paymentMethod, cashReceived }) {
  requireUuid(storeId, "ID toko");
  for (const item of items) requireUuid(item.id, "ID produk");
  const client = requireSupabase();
  const sale = throwIfError(await client.rpc("checkout_sale", {
    p_store_id: storeId,
    p_items: items.map((item) => ({ product_id: item.id, quantity: item.qty })),
    p_discount: discount,
    p_tax_rate: taxRate,
    p_payment_method: paymentMethod,
    p_cash_received: cashReceived
  }));
  if (!sale?.id || !sale?.receipt_number) {
    throw new Error("RPC checkout_sale tidak mengembalikan transaksi yang valid.");
  }
  return mapSale(sale, sale.items || items.map((item) => ({
    product_id: item.id,
    product_name: item.name,
    sku: item.sku,
    quantity: item.qty,
    unit_price: item.price,
    line_total: item.price * item.qty
  })));
}
