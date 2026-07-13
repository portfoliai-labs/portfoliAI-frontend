import { ImageResponse } from "next/og";

export const alt = "PortfoliAI — AI-Powered Portfolio Intelligence";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#131210",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 40 }}>
          <div
            style={{
              display: "flex",
              width: 56,
              height: 56,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 6,
              background: "#1c1917",
            }}
          >
            <div style={{ display: "flex", width: 26, height: 26, border: "3px solid #C49A3C", borderRadius: 3 }} />
          </div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: "#fafaf9" }}>
            PortfoliAI
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 68,
            fontWeight: 700,
            lineHeight: 1.15,
            color: "#ffffff",
            maxWidth: 920,
          }}
        >
          See what your investments are really doing.
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 32,
            fontSize: 28,
            color: "#C49A3C",
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          AI-Powered Portfolio Intelligence
        </div>
      </div>
    ),
    { ...size }
  );
}
