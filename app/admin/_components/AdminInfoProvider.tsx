"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type AdminInfo = {
  id: string;
  name: string;
  email: string;
  adminType: string;
  permissions: string[];
  status: string;
  createdAt: string;
} | null;

const AdminInfoContext = createContext<{
  adminInfo: AdminInfo;
  loading: boolean;
  refresh: () => Promise<void>;
}>({
  adminInfo: null,
  loading: true,
  refresh: async () => {},
});

export function AdminInfoProvider({ children }: { children: ReactNode }) {
  const [adminInfo, setAdminInfo] = useState<AdminInfo>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/me", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setAdminInfo(json.admin);
      } else {
        setAdminInfo(null);
      }
    } catch {
      setAdminInfo(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  return (
    <AdminInfoContext.Provider value={{ adminInfo, loading, refresh }}>
      {children}
    </AdminInfoContext.Provider>
  );
}

export function useAdminInfo() {
  return useContext(AdminInfoContext);
}