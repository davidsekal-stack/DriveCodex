/**
 * SVG sloupcový graf — znovupoužitelná komponenta pro analytics.
 * Props: data, labelKey, valueKey, color, height, formatValue
 */
import { useTheme } from "../contexts/ThemeContext.jsx";

export default function BarChart({ data, labelKey, valueKey, color, height = 160, formatValue }) {
  const { t } = useTheme();
  if (!data.length) return null;

  const values = data.map((d) => d[valueKey] ?? 0);
  const max = Math.max(...values, 1);
  const barW = Math.max(8, Math.min(28, Math.floor(600 / data.length) - 4));
  const chartW = data.length * (barW + 4) + 40;
  const fmt = formatValue || ((v) => v.toLocaleString());

  return (
    <div style={{ overflowX: "auto", marginBottom: 8 }}>
      <svg width={Math.max(chartW, 300)} height={height + 30} style={{ display: "block" }}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map((frac) => (
          <line
            key={frac}
            x1={35} y1={height - height * frac}
            x2={chartW} y2={height - height * frac}
            stroke={t.border} strokeDasharray="3,3"
          />
        ))}
        {/* Y-axis labels */}
        {[0, 0.5, 1].map((frac) => (
          <text key={frac} x={32} y={height - height * frac + 4}
            textAnchor="end" fill={t.textVeryFaint} fontSize={9} fontFamily="inherit">
            {fmt(Math.round(max * frac))}
          </text>
        ))}
        {/* Bars */}
        {data.map((d, i) => {
          const val = d[valueKey] ?? 0;
          const barH = (val / max) * height;
          const x = 40 + i * (barW + 4);
          const label = d[labelKey] ?? "";
          const showLabel = data.length <= 15 || i % Math.ceil(data.length / 10) === 0 || i === data.length - 1;
          return (
            <g key={i}>
              <rect
                x={x} y={height - barH}
                width={barW} height={Math.max(barH, 1)}
                fill={color} rx={1} opacity={0.85}
              />
              <title>{`${label}: ${fmt(val)}`}</title>
              {showLabel && (
                <text x={x + barW / 2} y={height + 14}
                  textAnchor="middle" fill={t.textVeryFaint} fontSize={8} fontFamily="inherit">
                  {label.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
