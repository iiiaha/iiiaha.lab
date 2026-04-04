"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

interface BugReport {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  user_id: string;
  products: { display_name: string; slug: string };
}

const STATUS_OPTIONS = ["open", "in_progress", "resolved", "closed"];

const statusStyle = (s: string) => {
  if (s === "open") return "text-red-600";
  if (s === "in_progress") return "text-yellow-600";
  if (s === "resolved") return "text-green-600";
  return "text-[#999]";
};

export default function AdminBugs() {
  const supabase = createClient();
  const [reports, setReports] = useState<BugReport[]>([]);
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editNote, setEditNote] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("bug_reports")
      .select("*, products(display_name, slug)")
      .order("created_at", { ascending: false });
    setReports((data as unknown as BugReport[]) ?? []);
  };

  useEffect(() => { load(); }, []);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("bug_reports").update({ status }).eq("id", id);
    showMessage("Status updated");
    load();
  };

  const saveNote = async (id: string) => {
    await supabase.from("bug_reports").update({ admin_note: editNote }).eq("id", id);
    showMessage("Note saved");
    load();
  };

  const filtered = filter === "all"
    ? reports
    : reports.filter((r) => r.status === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-[16px] font-bold tracking-[0.03em]">Bug Reports</h1>
          {message && <span className="text-[11px] text-green-600">{message}</span>}
        </div>
        <span className="text-[12px] text-[#999]">{reports.length} total</span>
      </div>
      <div className="border-t border-[#111] mb-6" />

      {/* Filter */}
      <div className="flex gap-4 mb-6">
        {["all", ...STATUS_OPTIONS].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-[12px] bg-transparent border-0 cursor-pointer uppercase tracking-[0.05em] ${
              filter === f ? "font-bold text-[#111]" : "text-[#999]"
            }`}
          >
            {f} ({f === "all" ? reports.length : reports.filter((r) => r.status === f).length})
          </button>
        ))}
      </div>

      {/* Reports */}
      <div className="border-t border-[#ddd]">
        {filtered.length === 0 ? (
          <p className="text-[13px] text-[#999] py-4">No reports.</p>
        ) : (
          filtered.map((r) => (
            <div key={r.id} className="border-b border-[#ddd]">
              <div
                onClick={() => {
                  setExpanded(expanded === r.id ? null : r.id);
                  setEditNote(r.admin_note ?? "");
                }}
                className="flex items-center justify-between py-3 cursor-pointer hover:bg-[#fafafa]"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[11px] font-bold uppercase ${statusStyle(r.status)}`}>
                      {r.status}
                    </span>
                    <span className="text-[13px] font-bold">{r.title}</span>
                  </div>
                  <div className="text-[11px] text-[#999] flex gap-3">
                    <span>{r.products?.display_name}</span>
                    <span>{new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  </div>
                </div>
                <span className="text-[13px] text-[#ccc]">{expanded === r.id ? "−" : "+"}</span>
              </div>

              {expanded === r.id && (
                <div className="pb-4 px-2">
                  {/* Description */}
                  <div className="bg-[#fafafa] border border-[#eee] p-4 mb-3">
                    <p className="text-[13px] whitespace-pre-wrap leading-relaxed">{r.description}</p>
                  </div>

                  {/* Screenshot */}
                  {r.image_url && (
                    <div className="mb-3">
                      <a href={r.image_url} target="_blank" rel="noopener noreferrer">
                        <img src={r.image_url} alt="screenshot" className="max-w-[400px] max-h-[250px] object-contain border border-[#ddd]" />
                      </a>
                    </div>
                  )}

                  {/* Status change */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[11px] text-[#999]">Status:</span>
                    {STATUS_OPTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => updateStatus(r.id, s)}
                        className={`text-[11px] px-2 py-0.5 border cursor-pointer ${
                          r.status === s
                            ? "bg-[#111] text-white border-[#111]"
                            : "bg-white text-[#666] border-[#ddd] hover:border-[#111]"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  {/* Admin note */}
                  <div>
                    <span className="text-[11px] text-[#999] block mb-1">Admin note:</span>
                    <textarea
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      rows={2}
                      className="w-full border border-[#ddd] px-2 py-1.5 text-[13px] outline-none focus:border-[#111] resize-y font-[inherit] mb-2"
                      placeholder="Internal note (not visible to user)"
                    />
                    <button
                      onClick={() => saveNote(r.id)}
                      className="text-[11px] bg-[#111] text-white px-3 py-1 border-0 cursor-pointer hover:bg-[#333]"
                    >
                      Save note
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
