"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

interface License {
  id: string;
  license_key: string;
  hwid: string | null;
  status: string;
  activated_at: string | null;
  created_at: string;
  products: {
    display_name: string;
    slug: string;
  };
}

export default function AdminLicenses() {
  const supabase = createClient();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("licenses")
      .select("*, products(display_name, slug)")
      .order("created_at", { ascending: false });
    setLicenses((data as unknown as License[]) ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  };

  const deactivateDevice = async (id: string) => {
    if (!confirm("Remove device binding? User will need to re-activate."))
      return;
    const { error } = await supabase
      .from("licenses")
      .update({ hwid: null, activated_at: null })
      .eq("id", id);
    if (error) {
      showMessage(`Error: ${error.message}`);
      return;
    }
    showMessage("Device deactivated");
    load();
  };

  const revokeLicense = async (id: string) => {
    if (!confirm("Revoke this license? It will no longer work.")) return;
    const { error } = await supabase
      .from("licenses")
      .update({ status: "revoked" })
      .eq("id", id);
    if (error) {
      showMessage(`Error: ${error.message}`);
      return;
    }
    showMessage("License revoked");
    load();
  };

  const reactivateLicense = async (id: string) => {
    const { error } = await supabase
      .from("licenses")
      .update({ status: "active", hwid: null, activated_at: null })
      .eq("id", id);
    if (error) {
      showMessage(`Error: ${error.message}`);
      return;
    }
    showMessage("License reactivated");
    load();
  };

  const filtered = search
    ? licenses.filter(
        (l) =>
          l.license_key.toLowerCase().includes(search.toLowerCase()) ||
          l.products?.display_name
            .toLowerCase()
            .includes(search.toLowerCase())
      )
    : licenses;

  return (
    <div>
      <h1 className="text-[16px] font-bold tracking-[0.03em] mb-6">
        Licenses
      </h1>
      <div className="border-t border-[#111] mb-6" />

      {message && (
        <p className="text-[12px] text-green-600 mb-4">{message}</p>
      )}

      {/* Search */}
      <input
        type="text"
        placeholder="Search by key or product name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border border-[#ddd] px-3 py-2 text-[13px] outline-none focus:border-[#111] mb-6"
      />

      {/* Summary */}
      <div className="flex gap-6 mb-6 text-[12px] text-[#999]">
        <span>Total: {licenses.length}</span>
        <span>
          Active: {licenses.filter((l) => l.status === "active").length}
        </span>
        <span>
          Bound: {licenses.filter((l) => l.hwid).length}
        </span>
        <span>
          Revoked: {licenses.filter((l) => l.status === "revoked").length}
        </span>
      </div>

      {/* Table */}
      <div className="border-t border-[#ddd]">
        {filtered.length === 0 ? (
          <p className="text-[13px] text-[#999] py-4">No licenses.</p>
        ) : (
          filtered.map((lic) => (
            <div
              key={lic.id}
              className="border-b border-[#ddd] py-3"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold">
                    {lic.products?.display_name}
                  </span>
                  <span
                    className={`text-[11px] font-bold uppercase ${
                      lic.status === "active"
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {lic.status}
                  </span>
                </div>
                <div className="flex gap-2">
                  {lic.hwid && lic.status === "active" && (
                    <button
                      onClick={() => deactivateDevice(lic.id)}
                      className="text-[11px] text-[#111] bg-transparent border border-[#ddd] px-3 py-1 cursor-pointer hover:bg-[#f5f5f5]"
                    >
                      Unbind Device
                    </button>
                  )}
                  {lic.status === "active" ? (
                    <button
                      onClick={() => revokeLicense(lic.id)}
                      className="text-[11px] text-red-600 bg-transparent border border-[#ddd] px-3 py-1 cursor-pointer hover:bg-red-50"
                    >
                      Revoke
                    </button>
                  ) : (
                    <button
                      onClick={() => reactivateLicense(lic.id)}
                      className="text-[11px] text-green-600 bg-transparent border border-[#ddd] px-3 py-1 cursor-pointer hover:bg-green-50"
                    >
                      Reactivate
                    </button>
                  )}
                </div>
              </div>
              <div className="text-[11px] text-[#999] flex gap-4">
                <code className="bg-[#f5f5f5] px-1.5 py-0.5">
                  {lic.license_key}
                </code>
                {lic.hwid ? (
                  <span>HWID: {lic.hwid.slice(0, 12)}...</span>
                ) : (
                  <span>Not bound</span>
                )}
                {lic.activated_at && (
                  <span>
                    Activated:{" "}
                    {new Date(lic.activated_at).toLocaleDateString("ko-KR")}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
