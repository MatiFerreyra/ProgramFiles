export type ModuleKey =
  | "dashboard"
  | "customers"
  | "inventory"
  | "sales"
  | "quotes"
  | "cash"
  | "schedule"
  | "suppliers"
  | "employees"
  | "reports";

export type TenantStatus = "active" | "suspended" | "archived";
export type TenantRole = "owner" | "admin" | "manager" | "sales" | "cashier" | "inventory" | "reception" | "viewer";

export type PermissionKey =
  | "view_customers" | "manage_customers"
  | "view_inventory" | "manage_inventory"
  | "view_sales" | "manage_sales"
  | "view_quotes" | "manage_quotes"
  | "view_cash" | "manage_cash"
  | "view_schedule" | "manage_schedule"
  | "view_suppliers" | "manage_suppliers"
  | "view_reports"
  | "manage_users" | "manage_settings" | "view_billing";

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  created_at?: string;
};

export type TenantSettings = {
  tenant_id: string;
  logo_url?: string | null;
  primary_color: string;
  sidebar_color: string;
  status: TenantStatus;
  modules: Record<ModuleKey, boolean>;
  owner_name?: string;
  owner_email?: string;
  owner_phone?: string;
  business_type?: string;
  address?: string;
  city?: string;
  province?: string;
  notes?: string;
  custom_domain?: string | null;
  updated_at?: string;
};

export type TenantMember = {
  tenant_id: string;
  user_id: string;
  role: TenantRole;
  permissions: Partial<Record<PermissionKey, boolean>>;
  active: boolean;
  created_at?: string;
  full_name?: string;
  email?: string;
};

export type Subscription = {
  id: string;
  tenant_id: string;
  plan?: string;
  status?: string;
  mrr?: number | string;
  monthly_price?: number | string;
  currency?: string;
  due_date?: string | null;
  grace_days?: number;
  auto_suspend?: boolean;
  payment_url?: string | null;
  external_reference?: string | null;
  last_paid_at?: string | null;
};

export const defaultModules: Record<ModuleKey, boolean> = {
  dashboard: true,
  customers: true,
  inventory: true,
  sales: true,
  quotes: true,
  cash: false,
  schedule: false,
  suppliers: false,
  employees: false,
  reports: true,
};
