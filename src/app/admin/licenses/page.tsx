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
  products: { name: string; slug: string };
}

interface UserGroup {
  userId: string;
  email: string;
  licenses: License[];
}

interface ProductOption {
  id: string;
  name: string;
  slug: string;
}

export default function AdminLicenses() {
  const supabase = createClient();
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [showIssue, setShowIssue] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [issueProductId, setIssueProductId] = useState("");
  const [issueEmail, setIssueEmail] = useState("");
  const [issueMemo, setIssueMemo] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [issuedKey, setIssuedKey] = useState("");

  const load = async () => {
    const { data: licenses } = await supabase
      .from("licenses")
      .select("*, products(name, slug)")
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

  const loadProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("id, name, slug")
      .eq("type", "extension")
      .order("created_at", { ascending: true });
    setProducts((data as ProductOption[]) ?? []);
    if (data && data.length > 0 && !issueProductId) {
      setIssueProductId(data[0].id);
    }
  };

  useEffect(() => { load(); loadProducts(); }, []);

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

  const issueLicense = async () => {
    if (!issueProductId) return;
    setIssuing(true);
    setIssuedKey("");
    try {
      const res = await fetch("/api/admin/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: issueProductId,
          user_email: issueEmail || undefined,
          memo: issueMemo || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setIssuedKey(data.license_key);
        showMessage(`발급 완료: ${data.license_key}`);
        load();
      } else {
        showMessage(`오류: ${data.error}`);
      }
    } catch {
      showMessage("발급 실패");
    } finally {
      setIssuing(false);
    }
  };

  const filtered = search
    ? groups.filter((g) =>
        g.email.toLowerCase().includes(search.toLowerCase()) ||
        g.licenses.some((l) =>
          l.license_key.toLowerCase().includes(search.toLowerCase()) ||
          l.products?.name.toLowerCase().includes(search.toLowerCase())
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
          <button
            onClick={() => { setShowIssue(!showIssue); setIssuedKey(""); }}
            className="bg-[#111] text-white text-[11px] font-bold px-3 py-1 border-0 cursor-pointer hover:bg-[#333]"
          >
            + 수동 발급
          </button>
        </div>
        <div className="flex gap-4 text-[12px] text-[#999]">
          <span>전체 {totalLicenses}</span>
          <span>활성 {activeLicenses}</span>
          <span>계정 {groups.length}</span>
        </div>
      </div>

      {showIssue && (
        <div className="border border-[#111] p-4 mb-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <label className="w-[60px] shrink-0 text-[11px] text-[#999] font-bold">제품</label>
              <select
                value={issueProductId}
                onChange={(e) => setIssueProductId(e.target.value)}
                className="flex-1 border border-[#ddd] px-2 py-1.5 text-[13px] outline-none focus:border-[#111]"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.slug})</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="w-[60px] shrink-0 text-[11px] text-[#999] font-bold">이메일</label>
              <input
                type="email"
                value={issueEmail}
                onChange={(e) => setIssueEmail(e.target.value)}
                placeholder="유저 이메일 (선택)"
                className="flex-1 border border-[#ddd] px-2 py-1.5 text-[13px] outline-none focus:border-[#111]"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="w-[60px] shrink-0 text-[11px] text-[#999] font-bold">메모</label>
              <input
                type="text"
                value={issueMemo}
                onChange={(e) => setIssueMemo(e.target.value)}
                placeholder="예: 베타테스트, 본인용 (선택)"
                className="flex-1 border border-[#ddd] px-2 py-1.5 text-[13px] outline-none focus:border-[#111]"
              />
            </div>
          </div>
          {issuedKey && (
            <div className="mt-3 p-3 bg-[#f5f5f5] border border-[#ddd]">
              <span className="text-[11px] text-[#999]">발급된 키:</span>
              <code className="ml-2 text-[14px] font-bold select-all">{issuedKey}</code>
            </div>
          )}
          <div className="flex gap-2 mt-3">
            <button
              onClick={issueLicense}
              disabled={issuing || !issueProductId}
              className="bg-[#111] text-white text-[12px] font-bold px-4 py-2 border-0 cursor-pointer hover:bg-[#333] disabled:opacity-40"
            >
              {issuing ? "..." : "발급"}
            </button>
            <button
              onClick={() => { setShowIssue(false); setIssuedKey(""); setIssueEmail(""); setIssueMemo(""); }}
              className="bg-white text-[#111] text-[12px] font-bold px-4 py-2 border border-[#ddd] cursor-pointer hover:bg-[#f5f5f5]"
            >
              닫기
            </button>
          </div>
        </div>
      )}

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
                          <span className="text-[12px] font-bold">{lic.products?.name}</span>
                          <span className={`text-[10px] font-bold ${lic.status === "active" ? "text-green-600" : "text-red-600"}`}>
                            {lic.status === "active" ? "활성" : "해지"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-[#999]">
                          <code className="bg-white px-1.5 py-0.5 border border-[#eee]">{lic.license_key}</code>
                          {lic.created_at && <span>{new Date(lic.created_at).toLocaleDateString("ko-KR")}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
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
