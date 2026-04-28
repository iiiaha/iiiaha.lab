import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "iiiaha.lab — Work Smart. Save Your Youth.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#111",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          letterSpacing: "0.05em",
        }}
      >
        <div style={{ fontSize: 96, fontWeight: 800 }}>iiiaha.lab</div>
        <div style={{ fontSize: 28, marginTop: 24, color: "#999" }}>
          Work Smart. Save Your Youth.
        </div>
      </div>
    ),
    size
  );
}
