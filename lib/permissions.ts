import { ModuleKey, PermissionKey, TenantRole } from "./types";

const full: PermissionKey[] = [
  "view_customers","manage_customers","view_inventory","manage_inventory","view_sales","manage_sales",
  "view_quotes","manage_quotes","view_cash","manage_cash","view_schedule","manage_schedule",
  "view_suppliers","manage_suppliers","view_reports","manage_users","manage_settings","view_billing",
];

export const rolePermissions: Record<TenantRole, PermissionKey[]> = {
  owner: full,
  admin: full,
  manager: full.filter(p => !["view_billing"].includes(p)),
  sales: ["view_customers","manage_customers","view_sales","manage_sales","view_quotes","manage_quotes","view_reports"],
  cashier: ["view_sales","manage_sales","view_cash","manage_cash","view_reports"],
  inventory: ["view_inventory","manage_inventory","view_suppliers","manage_suppliers","view_reports"],
  reception: ["view_customers","manage_customers","view_schedule","manage_schedule"],
  viewer: ["view_customers","view_inventory","view_sales","view_quotes","view_cash","view_schedule","view_suppliers","view_reports"],
};

export function hasPermission(role: TenantRole | null | undefined, overrides: Partial<Record<PermissionKey, boolean>> | null | undefined, permission: PermissionKey, isPlatformAdmin = false) {
  if (isPlatformAdmin) return true;
  if (!role) return false;
  if (typeof overrides?.[permission] === "boolean") return Boolean(overrides[permission]);
  return rolePermissions[role]?.includes(permission) ?? false;
}

export const moduleViewPermission: Partial<Record<ModuleKey, PermissionKey>> = {
  customers: "view_customers", inventory: "view_inventory", sales: "view_sales", quotes: "view_quotes",
  cash: "view_cash", schedule: "view_schedule", suppliers: "view_suppliers", employees: "manage_users", reports: "view_reports",
};

export const moduleManagePermission: Partial<Record<ModuleKey, PermissionKey>> = {
  customers: "manage_customers", inventory: "manage_inventory", sales: "manage_sales", quotes: "manage_quotes",
  cash: "manage_cash", schedule: "manage_schedule", suppliers: "manage_suppliers", employees: "manage_users",
};

export const roleLabels: Record<TenantRole, string> = {
  owner: "Dueño", admin: "Administrador", manager: "Encargado", sales: "Ventas", cashier: "Caja",
  inventory: "Depósito", reception: "Recepción", viewer: "Solo lectura",
};
