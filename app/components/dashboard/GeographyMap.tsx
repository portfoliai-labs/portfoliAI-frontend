// components/dashboard/GeographyMap.tsx
"use client";

import { useMemo, useRef, useState, type ComponentProps } from "react";
import { geoEquirectangular } from "d3-geo";
import { ComposableMap, Geographies, Geography, Sphere } from "react-simple-maps";
import worldTopology from "world-atlas/countries-110m.json";
import type { ExposureEntryResponse } from "../../models/PortfolioData";

// The map's own coordinate space (its SVG viewBox) — independent of how wide the card
// rendering it happens to be, since ComposableMap scales this box to fill the container via
// `style={{ width: "100%" }}` and keeps the aspect ratio. Equirectangular is the classic flat,
// edge-to-edge rectangular world map (every pseudo-cylindrical alternative — equal-earth,
// Robinson, Natural Earth — draws a lens/oval silhouette that tapers at the poles, which read
// as "a globe" rather than a flat map once the sphere's own outline was stroked). Fitting that
// projection to the *whole sphere* gives a rectangle spanning almost the entire [MAP_WIDTH,
// MAP_HEIGHT] box on its own (no hand-picked scale to get wrong), so nothing is clipped and
// nothing tapers into an oval.
const MAP_WIDTH = 960;
const MAP_HEIGHT = 500;

// react-simple-maps' `geography` prop is declared as `string | GeoJsonObject |
// GeoJsonObject[]`, but its runtime also accepts a raw topojson Topology (it checks
// `type === "Topology"` internally and converts it) — the public types just don't reflect
// that, so this cast tells TS what we already know from the library's own source. Pulling the
// type off the component itself (rather than importing the `geojson` package directly) avoids
// depending on a transitive type package pnpm doesn't hoist to the project root.
const WORLD_TOPOLOGY = worldTopology as unknown as ComponentProps<typeof Geographies>["geography"];

// Natural Earth leaves a handful of disputed territories (Kosovo, Somaliland, Northern
// Cyprus) without a numeric ISO id — none of them are in COUNTRY_REGION anyway, but the
// GeoJSON `id` type includes `undefined`, so every lookup below narrows to `string` first.
type CountryFeatureId = string | number | undefined;
function regionForCountry(id: CountryFeatureId): string | null {
  return typeof id === "string" ? COUNTRY_REGION[id] ?? null : null;
}

// The region exposure endpoint only ever returns four geographic buckets today (see the
// comment on ExposureEntryResponse in models/PortfolioData.ts): North America, Europe,
// Pacific and Emerging Markets, plus "Unknown" for assets with no known breakdown. Those
// buckets don't correspond to a contiguous shape on a map — "Emerging Markets" alone spans
// Asia, Latin America, Africa and Eastern Europe — so coloring the map means picking *some*
// country-to-bucket classification. This table is a fixed, hand-maintained approximation of
// the standard MSCI developed/emerging split, chosen only to answer "which countries make up
// this bucket" for the picture; it is not derived from whatever methodology actually produced
// the backend's percentages, and a name the provider weighs differently still rolls up the
// same way here. Countries left out render in the neutral "no data" tone below, meaning
// "outside this simplified bucket set" — not "zero exposure".
//
// Keyed by ISO 3166-1 numeric code (the `id` on each geometry in the topojson below), which
// is stable regardless of how a country's name is spelled in the map data.
const NORTH_AMERICA = "North America";
const EUROPE = "Europe";
const PACIFIC = "Pacific";
const EMERGING_MARKETS = "Emerging Markets";

const COUNTRY_REGION: Record<string, string> = {
  // North America
  "124": NORTH_AMERICA, // Canada
  "840": NORTH_AMERICA, // United States
  // Europe (developed)
  "040": EUROPE, // Austria
  "056": EUROPE, // Belgium
  "208": EUROPE, // Denmark
  "246": EUROPE, // Finland
  "250": EUROPE, // France
  "276": EUROPE, // Germany
  "372": EUROPE, // Ireland
  "380": EUROPE, // Italy
  "442": EUROPE, // Luxembourg
  "528": EUROPE, // Netherlands
  "578": EUROPE, // Norway
  "620": EUROPE, // Portugal
  "724": EUROPE, // Spain
  "752": EUROPE, // Sweden
  "756": EUROPE, // Switzerland
  "826": EUROPE, // United Kingdom
  // Pacific (developed Asia-Pacific). Hong Kong and Singapore are also part of this bucket
  // in the standard classification, but at the map's resolution they're too small to render
  // as their own shape, so there is nothing on the map to color for them.
  "036": PACIFIC, // Australia
  "392": PACIFIC, // Japan
  "554": PACIFIC, // New Zealand
  // Emerging Markets
  "076": EMERGING_MARKETS, // Brazil
  "152": EMERGING_MARKETS, // Chile
  "156": EMERGING_MARKETS, // China
  "158": EMERGING_MARKETS, // Taiwan
  "170": EMERGING_MARKETS, // Colombia
  "203": EMERGING_MARKETS, // Czechia
  "300": EMERGING_MARKETS, // Greece
  "348": EMERGING_MARKETS, // Hungary
  "356": EMERGING_MARKETS, // India
  "360": EMERGING_MARKETS, // Indonesia
  "410": EMERGING_MARKETS, // South Korea
  "414": EMERGING_MARKETS, // Kuwait
  "458": EMERGING_MARKETS, // Malaysia
  "484": EMERGING_MARKETS, // Mexico
  "604": EMERGING_MARKETS, // Peru
  "608": EMERGING_MARKETS, // Philippines
  "616": EMERGING_MARKETS, // Poland
  "634": EMERGING_MARKETS, // Qatar
  "682": EMERGING_MARKETS, // Saudi Arabia
  "710": EMERGING_MARKETS, // South Africa
  "764": EMERGING_MARKETS, // Thailand
  "784": EMERGING_MARKETS, // United Arab Emirates
  "792": EMERGING_MARKETS, // Turkey
  "818": EMERGING_MARKETS, // Egypt
};

// A couple of Natural Earth's abbreviated names look odd in a tooltip; only worth normalizing
// for the handful of countries that are actually classified above and likely to be hovered.
const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  "United States of America": "United States",
};

// Fixed per-bucket hues (blue / orange / aqua / violet) — chosen and validated with the
// dataviz skill's palette validator for an all-pairs (choropleth) use, not lifted from the
// skill's default 8-hue theme, whose 4th slot collides with its 2nd under that stricter test.
// `node scripts/validate_palette.js "#2a78d6,#eb6834,#1baf7a,#4a3aa7" --mode light --pairs all`
// → all checks pass (CVD ΔE 9.2, normal-vision ΔE 16.3; one slot sits under the 3:1 contrast
// floor, which is why identity is never carried by the map fill alone — the legend and
// tooltip below always spell out the name and percentage in text).
const REGION_COLORS: Record<string, string> = {
  [NORTH_AMERICA]: "#2a78d6",
  [EUROPE]: "#eb6834",
  [PACIFIC]: "#1baf7a",
  [EMERGING_MARKETS]: "#4a3aa7",
};
const REGION_ORDER = [NORTH_AMERICA, EUROPE, PACIFIC, EMERGING_MARKETS];

// A country whose bucket carries no exposure this period — or that isn't part of the bucket
// set at all — reads the same neutral "nothing here" tone, matching UNKNOWN_EXPOSURE_COLOR
// used elsewhere in this module for the same idea.
const NO_EXPOSURE_COLOR = "#e2e8f0";
const UNKNOWN_LEGEND_COLOR = "#cbd5e1";

function displayName(name: string): string {
  return DISPLAY_NAME_OVERRIDES[name] ?? name;
}

type HoverInfo = { name: string; region: string | null; pct: number; x: number; y: number };

/**
 * GEOGRAPHY MAP — a flat world map for the "By region" panel: countries are grouped into the
 * same four buckets the region-exposure endpoint reports, tinted by that bucket's weight (a
 * bucket at 0% reads as "no exposure", not as a faint version of its color), with a hover
 * tooltip giving the exact percentage. The legend beneath doubles as the table-view fallback
 * so no value ever depends on reading the map's color alone.
 */
export function GeographyMap({ entries }: { entries: ExposureEntryResponse[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  const pctByRegion = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach((e) => {
      map[e.label] = e.weightPct;
    });
    return map;
  }, [entries]);

  const maxPct = Math.max(...REGION_ORDER.map((r) => pctByRegion[r] ?? 0), 0.01);

  // Fit once — the sphere's fitted scale/translate only depend on the fixed viewBox size
  // above, never on props, so this never needs to recompute.
  const projection = useMemo(() => geoEquirectangular().fitSize([MAP_WIDTH, MAP_HEIGHT], { type: "Sphere" }), []);

  if (entries.length === 0) {
    return <p className="text-sm text-slate-400 py-6">No data yet.</p>;
  }

  const handleMove = (event: React.MouseEvent, name: string, region: string | null, pct: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ name, region, pct, x: event.clientX - rect.left, y: event.clientY - rect.top });
  };

  // Legend rows: the four known buckets first, in the map's fixed color order (so the swatch
  // never changes meaning), then anything else the backend returned (in practice "Unknown")
  // so the percentages shown always add up to the full held weight.
  const knownLabels = new Set(REGION_ORDER);
  const legendRows = [
    ...REGION_ORDER.filter((r) => pctByRegion[r] !== undefined).map((r) => ({ label: r, weightPct: pctByRegion[r] })),
    ...entries.filter((e) => !knownLabels.has(e.label)),
  ];

  return (
    <div>
      <div ref={containerRef} className="relative" onMouseLeave={() => setHover(null)}>
        <ComposableMap
          projection={projection}
          width={MAP_WIDTH}
          height={MAP_HEIGHT}
          style={{ width: "100%", height: "auto" }}
        >
          <Sphere id="rsm-sphere" fill="transparent" stroke="#e2e8f0" strokeWidth={0.5} />
          <Geographies geography={WORLD_TOPOLOGY}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const region = regionForCountry(geo.id);
                const pct = region ? pctByRegion[region] ?? 0 : 0;
                const name = displayName((geo.properties as { name?: string } | null)?.name ?? "Unknown");
                const isHovered = hover?.name === name && hover.region === region;
                const fill = pct > 0 && region ? REGION_COLORS[region] : NO_EXPOSURE_COLOR;
                const fillOpacity = pct > 0 ? 0.45 + 0.55 * (pct / maxPct) : 1;
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fill}
                    fillOpacity={fillOpacity}
                    stroke="#ffffff"
                    strokeWidth={isHovered ? 1 : 0.5}
                    style={{ outline: "none", cursor: region ? "pointer" : "default" }}
                    onMouseEnter={(event) => handleMove(event, name, region, pct)}
                    onMouseMove={(event) => handleMove(event, name, region, pct)}
                    onMouseLeave={() => setHover(null)}
                  />
                );
              })
            }
          </Geographies>
        </ComposableMap>
        {hover && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] shadow-lg"
            style={{ left: hover.x, top: hover.y - 8 }}
          >
            <div className="font-bold text-slate-900">{hover.name}</div>
            {hover.region ? (
              <div className="text-slate-500">
                {hover.region} · <span className="font-bold tabular-nums">{hover.pct.toFixed(1)}%</span>
              </div>
            ) : (
              <div className="text-slate-400">Not in this breakdown</div>
            )}
          </div>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {legendRows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: REGION_COLORS[row.label] ?? UNKNOWN_LEGEND_COLOR }}
              />
              <span className="font-bold text-slate-900 truncate">{row.label}</span>
            </span>
            <span className="font-bold text-slate-500 shrink-0 tabular-nums">{row.weightPct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
