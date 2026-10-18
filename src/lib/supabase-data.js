import { supabase } from "./supabase";

export async function getSupabaseDataStatus() {
  if (!supabase) {
    return {
      ready: false,
      tables: {},
      message: "Supabase belum dikonfigurasi. Set VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY."
    };
  }

  return {
    ready: false,
    tables: {},
    message: "Supabase Auth dapat digunakan, tetapi akses data toko dinonaktifkan sampai skema database dan kebijakan RLS diverifikasi. Repo ini belum menyediakan migrasi atau bukti kebijakan tersebut."
  };
}

// Business-data access stays disabled until the real schema and RLS policies are reviewed.
export async function fetchStoreMemberships() {
  return [];
}

export async function createSupabaseStore() {
  return null;
}

export async function fetchProductsByStore() {
  return [];
}

export async function upsertSupabaseProduct() {
  return false;
}

export async function insertSupabaseSale() {
  return false;
}
