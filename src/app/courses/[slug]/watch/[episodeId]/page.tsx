"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const episodeId = params.episodeId as string;

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [duration, setDuration] = useState(0);
  const [resumeTime, setResumeTime] = useState(0);
  const [completed, setCompleted] = useState(false);
  const lastSavedRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const saveProgress = useCallback(
    async (seconds: number) => {
      if (Math.abs(seconds - lastSavedRef.current) < 5) return;
      lastSavedRef.current = seconds;

      try {
        const res = await fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            episodeId,
            watchedSeconds: Math.floor(seconds),
            duration,
          }),
        });
        const data = await res.json();
        if (data.completed && !completed) {
          setCompleted(true);
        }
      } catch {
        // ignore - will retry next cycle
      }
    },
    [episodeId, duration, completed]
  );

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`/api/stream?episodeId=${episodeId}`);
      const data = await res.json();
      if (res.ok) {
        setVideoUrl(data.url);
      } else {
        setError(data.error || "Failed to load video");
        if (res.status === 401) {
          router.push("/login");
        }
        setLoading(false);
        return;
      }

      const supabase = createClient();
      const { data: ep } = await supabase
        .from("course_episodes")
        .select("duration")
        .eq("id", episodeId)
        .single();
      if (ep?.duration) setDuration(ep.duration);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: progress } = await supabase
          .from("course_progress")
          .select("watched_seconds, completed")
          .eq("user_id", user.id)
          .eq("episode_id", episodeId)
          .single();

        if (progress) {
          if (progress.completed) {
            setResumeTime(0);
            setCompleted(true);
          } else {
            setResumeTime(Math.max(0, progress.watched_seconds - 5));
          }
        }
      }

      setLoading(false);
    };
    load();
  }, [episodeId, router]);

  useEffect(() => {
    if (!videoUrl || loading) return;

    let elapsed = resumeTime;

    intervalRef.current = setInterval(() => {
      elapsed += 10;
      saveProgress(elapsed);
    }, 10000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (elapsed > 0) {
        saveProgress(elapsed);
      }
    };
  }, [videoUrl, loading, resumeTime, saveProgress]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      const body = JSON.stringify({
        episodeId,
        watchedSeconds: Math.floor(lastSavedRef.current),
        duration,
      });
      navigator.sendBeacon("/api/progress", body);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [episodeId, duration]);

  if (loading) {
    return (
      <div className="pt-20 text-center text-[14px] text-[#999]">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="pt-20 text-center">
        <p className="text-[14px] text-red-600 mb-4">{error}</p>
        <Link
          href={`/courses/${slug}`}
          className="text-[13px] text-[#111] underline"
        >
          Back to course
        </Link>
      </div>
    );
  }

  const videoSrc = videoUrl
    ? resumeTime > 0
      ? `${videoUrl}?startTime=${resumeTime}`
      : videoUrl
    : "";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Link
          href={`/courses/${slug}`}
          className="text-[12px] text-[#999] no-underline hover:underline"
        >
          Back to course
        </Link>
        {completed && (
          <span className="text-[11px] text-green-600 font-bold">
            Completed
          </span>
        )}
      </div>

      <div className="aspect-video bg-black mb-6">
        {videoSrc && (
          <iframe
            ref={iframeRef}
            src={videoSrc}
            className="w-full h-full border-0"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>

      {duration > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-[11px] text-[#999] mb-1">
            <span>
              {Math.floor(lastSavedRef.current / 60)}:
              {String(Math.floor(lastSavedRef.current % 60)).padStart(2, "0")}
            </span>
            <span>
              {Math.floor(duration / 60)}:
              {String(duration % 60).padStart(2, "0")}
            </span>
          </div>
          <div className="w-full h-1 bg-[#ddd]">
            <div
              className="h-full bg-[#111] transition-all duration-500"
              style={{
                width: `${Math.min(
                  (lastSavedRef.current / duration) * 100,
                  100
                )}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
