import { formatCurrency } from "@/lib/format";
import type { SalesPoint } from "@/lib/dashboard";

const chartWidth = 720;
const chartHeight = 240;
const padding = { top: 18, right: 18, bottom: 36, left: 18 };

export function SalesChart({ data }: { data: SalesPoint[] }) {
  const maxRevenue = Math.max(...data.map((point) => point.revenue_cents), 1);
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;
  const coordinates = data.map((point, index) => ({
    x: padding.left + (data.length === 1 ? innerWidth / 2 : (index / (data.length - 1)) * innerWidth),
    y: padding.top + innerHeight - (point.revenue_cents / maxRevenue) * innerHeight,
    point
  }));
  const line = coordinates.map(({ x, y }) => `${x},${y}`).join(" ");
  const area = coordinates.length
    ? `${padding.left},${padding.top + innerHeight} ${line} ${padding.left + innerWidth},${padding.top + innerHeight}`
    : "";
  const hasSales = data.some((point) => point.revenue_cents > 0);

  return (
    <div>
      <div className="relative overflow-hidden border border-border bg-white p-3">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="h-auto min-h-56 w-full"
          role="img"
          aria-labelledby="sales-chart-title sales-chart-description"
        >
          <title id="sales-chart-title">Të ardhurat e porosive të dorëzuara</title>
          <desc id="sales-chart-description">
            {hasSales
              ? `Kulmi i periudhës është ${formatCurrency(maxRevenue)}.`
              : "Nuk ka të ardhura të dorëzuara në këtë periudhë."}
          </desc>
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const y = padding.top + innerHeight * fraction;
            return (
              <line
                key={fraction}
                x1={padding.left}
                x2={padding.left + innerWidth}
                y1={y}
                y2={y}
                stroke="currentColor"
                className="text-border"
                strokeDasharray="5 5"
              />
            );
          })}
          {area ? <polygon points={area} className="fill-primary/10" /> : null}
          {line ? (
            <polyline
              points={line}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="4"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
          {coordinates.map(({ x, y, point }) => (
            <circle key={point.bucket_start} cx={x} cy={y} r="4" className="fill-accent stroke-primary" strokeWidth="2">
              <title>{`${formatShortDate(point.bucket_start)}: ${formatCurrency(point.revenue_cents)}, ${point.order_count} porosi`}</title>
            </circle>
          ))}
          {coordinates.filter((_, index) => shouldLabel(index, coordinates.length)).map(({ x, point }) => (
            <text
              key={`label-${point.bucket_start}`}
              x={x}
              y={chartHeight - 9}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px] font-semibold"
            >
              {formatShortDate(point.bucket_start)}
            </text>
          ))}
        </svg>
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-semibold text-primary underline-offset-4 hover:underline">
          Shiko të dhënat në tabelë
        </summary>
        <div className="mt-3 max-h-64 overflow-auto border">
          <table className="w-full min-w-80 text-left">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th className="px-3 py-2">Periudha</th>
                <th className="px-3 py-2 text-right">Porosi</th>
                <th className="px-3 py-2 text-right">Të ardhura</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((point) => (
                <tr key={point.bucket_start}>
                  <td className="px-3 py-2">{formatShortDate(point.bucket_start)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{point.order_count}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatCurrency(point.revenue_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function shouldLabel(index: number, length: number) {
  if (length <= 7) return true;
  const step = Math.max(1, Math.ceil(length / 6));
  return index === 0 || index === length - 1 || index % step === 0;
}

function formatShortDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}.${month}` : value;
}
