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
  user_id: string;
  products: { display_name: string; slug: string };
}

interface UserGroup {
  userId: string;
  email: string;
  licenses: License[];
}

export default function AdminLicenses() {
  const supabase = createClient();
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data: licenses } = await supabase
      .from("licenses")
      .select("*, products(display_name, slug)")
      .order("created_at", { ascending: false });

    if (!licenses) { setLoading(false); return; }

    const userMap: Record<string, License[]> = {};
    licenses.forEach((l: unknown) => {
      const lic = l as License;
      if (!userMap[lic.user_id]) userMap[lic.user_id] = [];
      userMap[lic.user_id].push(lic);
    });

    const userIds = Object.keys(userMap);
    const groupList: UserGroup[] = [];
    for (const uid of userIds) {
      const res = await fetch(`/api/user-email?id=${uid}&full=true`);
      const data = await res.json();
      groupList.push({
        userId: uid,
        email: data.name || uid.slice(0, 8),
        licenses: userMap[uid],
      });
    }
    setGroups(groupList);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  };

  const deactivateDevice = async (id: string) => {
    if (!confirm("기기 바인딩을 해제하시겠습니까?")) return;
    await supabase.from("licenses").update({ hwid: null, activated_at: null }).eq("id", id);
    showMessage("기기 해제됨");
    load();
  };

  const revokeLicense = async (id: string) => {
    if (!confirm("이 라이선스를 해지하시겠습니까?")) return;
    await supabase.from("licenses").update({ status: "revoked" }).eq("id", id);
    showMessage("라이선스 해지됨");
    load();
  };

  const reactivateLicense = async (id: string) => {
    await supabase.from("licenses").update({ status: "active", hwid: null, activated_at: null }).eq("id", id);
    showMessage("라이선스 재활성화됨");
    load();
  };

  const filtered = search
    ? groups.filter((g) =>
        g.email.toLowerCase().includes(search.toLowerCase()) ||
        g.licenses.some((l) =>
          l.license_key.toLowerCase().includes(search.toLowerCase()) ||
          l.products?.display_name.toLowerCase().includes(search.toLowerCase())
        )
      )
    : groups;

  const totalLicenses = groups.reduce((sum, g) => sum + g.licenses.length, 0);
  const activeLicenses = groups.reduce((sum, g) => sum + g.licenses.filter((l) => l.status === "active").length, 0);

  if (loading) return <p className="text-[14px] text-[#999]">로딩 중...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-[16px] font-bold">라이선스</h1>
          {message && <span className="text-[11px] text-green-600">{message}</span>}
        </div>
        <div className="flex gap-4 text-[12px] text-[#999]">
          <span>전체 {totalLicenses}</span>
          <span>활성 {activeLicenses}</span>
          <span>계정 {groups.length}</span>
        </div>
      </div>

      <input
        type="text"
        placeholder="계정, 라이선스 키, 제품명 검색..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border border-[#ddd] px-3 py-2 text-[13px] outline-none focus:border-[#111] mb-6"
      />

      <div className="border-t border-[#ddd]">
        {filtered.length === 0 ? (
          <p className="text-[13px] text-[#999] py-4">결과 없음</p>
        ) : (
          filtered.map((group) => (
            <div key={group.userId}>
              <div
                onClick={() => setExpanded(expanded === group.userId ? null : group.userId)}
                className="flex items-center justify-between border-b border-[#ddd] py-2.5 cursor-pointer hover:bg-[#fafafa]"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[13px] font-bold">{group.email}</span>
                  <span className="text-[11px] text-[#999]">{group.licenses.length}개</span>
                </div>
                <span className="text-[13px] text-[#ccc]">{expanded === group.userId ? "−" : "+"}</span>
              </div>

              {expanded === group.userId && (
                <div className="bg-[#fafafa] border-b border-[#ddd]">
                  {group.licenses.map((lic) => (
                    <div key={lic.id} className="flex items-center justify-between px-4 py-2 border-b border-[#eee] last:border-0">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[12px] font-bold">{lic.products?.display_name}</span>
                          <span className={`text-[10px] font-bold ${lic.status === "active" ? "text-green-600" : "text-red-600"}`}>
                            {lic.status === "active" ? "활성" : "해지"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-[#999]">
                          <code className="bg-white px-1.5 py-0.5 border border-[#eee]">{lic.license_key}</code>
                          {lic.hwid ? <span>기기 바인딩됨</span> : <span>미바인딩</span>}
                          {lic.activated_at && <span>{new Date(lic.activated_at).toLocaleDateString("ko-KR")}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {lic.hwid && lic.status === "active" && (
                          <button onClick={() => deactivateDevice(lic.id)}
                            className="text-[10px] text-[#999] bg-transparent border border-[#ddd] px-2 py-0.5 cursor-pointer hover:bg-white">
                            기기해제
                          </button>
                        )}
                        {lic.status === "active" ? (
                          <button onClick={() => revokeLicense(lic.id)}
                            className="text-[10px] text-red-600 bg-transparent border border-[#ddd] px-2 py-0.5 cursor-pointer hover:bg-red-50">
                            해지
                          </button>
                        ) : (
                          <button onClick={() => reactivateLicense(lic.id)}
                            className="text-[10px] text-green-600 bg-transparent border border-[#ddd] px-2 py-0.5 cursor-pointer hover:bg-green-50">
                            재활성화
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
