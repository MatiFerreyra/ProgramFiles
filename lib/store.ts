export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  modules: {
    sales: boolean;
    inventory: boolean;
    schedule: boolean;
    customers: boolean;
    suppliers: boolean;
    reports: boolean;
  };
}

// Datos iniciales de prueba para ver reflejado el funcionamiento
export const initialTenants: Tenant[] = [
  {
    id: "1",
    name: "Barbería Urbano",
    subdomain: "barberia-urbano",
    logoUrl: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=100&h=100&fit=crop",
    primaryColor: "#0f172a",
    secondaryColor: "#38bdf8",
    modules: {
      sales: true,
      inventory: false,
      schedule: true,
      customers: true,
      suppliers: false,
      reports: true,
    },
  },
  {
    id: "2",
    name: "Tienda De Ropa Chic",
    subdomain: "tienda-chic",
    logoUrl: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=100&h=100&fit=crop",
    primaryColor: "#831843",
    secondaryColor: "#f472b6",
    modules: {
      sales: true,
      inventory: true,
      schedule: false,
      customers: true,
      suppliers: true,
      reports: true,
    },
  },
];