export type Role = "admin" | "client";

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  phone: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export type ProductTier = "Basic" | "Premium";

export interface Product {
  id: string;
  title: string;
  description: string | null;
  tier: ProductTier;
  color_theme: string | null;
  images: string[];
  created_at: string;
}

export interface ProductCategory {
  product_id: string;
  category_id: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  size: string;
  total_stock: number;
}

export interface Wishlist {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
}

export type BookingStatus = "pending" | "confirmed" | "rejected" | "blocked_by_admin";

export interface Booking {
  id: string;
  product_id: string;
  size: string;
  user_id: string | null;
  start_date: string;
  end_date: string;
  status: BookingStatus;
  created_at: string;
}

export interface Settings {
  id: number;
  admin_phone: string | null;
  updated_at: string;
}

/** Narrow shape returned by the get_booked_ranges() RPC — never exposes client identities. */
export interface BookedRange {
  product_id: string;
  size: string;
  start_date: string;
  end_date: string;
  status: "confirmed" | "blocked_by_admin";
}
