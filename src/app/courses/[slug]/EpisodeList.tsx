"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Episode {
  id: string;
  title: string;
  description: string | null;
  duration: number | null;
  sort_order: number;
  is_preview: boolean;
}

interface ProgressMap {
  [episodeId: string]: {
    watched_seconds: number;
    completed: boolean;
    percent: number;
  };
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function EpisodeList({
  episodes,
  purchased,
  courseSlug,
  productId,
}: {
  episodes: Episode[];
  purchased: boolean;
  courseSlug: string;
  productId: string;
}) {
  const [progress, setProgress] = useState<ProgressMap>({});
  const [summary, setSummary] = useState({ total: 0, completed: 0 });

  useEffect(() => {
    if (!purchased || !productId) return;

    const load = async () => {
      const res = await fetch(`/api/progress?productId=${productId}`);
      if (res.ok) {
        const data = await res.json();
        setProgress(data.progress || {});
        setSummary(data.summary || { total: 0, completed: 0 });
      }
    };
    load();
  }, [purchased, productId]);

  return (
    <div>
      {/* Progress overview */}
      {purchased && summary.total > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] text-[#999]">
              {summary.completed}/{summary.total} completed
            </span>
            <span className="text-[12px] font-bold">
              {Math.round((summary.completed / summary.total) * 100)}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-[#ddd]">
            <div
              className="h-full bg-[#111] transition-all duration-300"
              style={{
                width: `${(summary.completed / summary.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="border-t border-[#ddd]">
        {episodes.map((ep, i) => {
          const canWatch = purchased || ep.is_preview;
          const prog = progress[ep.id];
          const isCompleted = prog?.completed || false;
          const percent = prog?.percent || 0;

          return (
            <div key={ep.id} className="border-b border-[#ddd]">
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="w-6 text-center">
                    {isCompleted ? (
                      <span className="text-[12px] text-green-600 font-bold">
                        ✓
                      </span>
                    ) : (
                      <span className="text-[12px] text-[#999]">
                        {(i + 1).toString().padStart(2, "0")}
                      </span>
                    )}
                  </span>
                  <div>
                    <span
                      className={`text-[13px] font-bold ${
                        isCompleted ? "text-[#999]" : ""
                      }`}
                    >
                      {ep.title}
                    </span>
                    {ep.is_preview && (
                      <span className="text-[10px] text-[#999] border border-[#ddd] px-1.5 py-0.5 ml-2">
                        Preview
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {purchased && percent > 0 && !isCompleted && (
                    <span className="text-[10px] text-[#999]">{percent}%</span>
                  )}
                  {ep.duration && (
                    <span className="text-[11px] text-[#999]">
                      {formatDuration(ep.duration)}
                    </span>
                  )}
                  {canWatch ? (
                    <Link
                      href={`/courses/${courseSlug}/watch/${ep.id}`}
                      className="text-[11px] text-[#111] border border-[#ddd] px-3 py-1 no-underline hover:bg-[#f5f5f5]"
                    >
                      {purchased && percent > 0 && !isCompleted
                        ? "Continue"
                        : isCompleted
                        ? "Rewatch"
                        : "Watch"}
                    </Link>
                  ) : (
                    <span className="text-[11px] text-[#ccc]">Locked</span>
                  )}
                </div>
              </div>
              {purchased && percent > 0 && !isCompleted && (
                <div className="w-full h-0.5 bg-[#eee]">
                  <div
                    className="h-full bg-[#111]"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              )}
              {isCompleted && (
                <div className="w-full h-0.5 bg-green-500" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
