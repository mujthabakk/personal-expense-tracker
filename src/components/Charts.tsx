import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, Tooltip, XAxis } from 'recharts';
import { chartColor } from '@/lib/color';
import { formatMoney } from '@/lib/money';
import type { CategorySpend, ChartPoint } from '@/services/finance';

const tooltipStyle = { background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 12 };

function ChartFrame({ height, children }: { height: number; children: (width: number) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const next = Math.floor(element.clientWidth);
      setWidth((current) => (current === next ? current : next));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} style={{ height }}>{width > 0 ? children(width) : null}</div>;
}

export function IncomeExpenseChart({ data, currency, language }: { data: ChartPoint[]; currency: string; language: string }) {
  return (
    <ChartFrame height={208}>
      {(width) => (
        <BarChart width={width} height={208} data={data} barGap={4}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: 'var(--surface-2)' }} formatter={(value) => formatMoney(Number(value), currency, language)} contentStyle={tooltipStyle} labelStyle={{ color: 'var(--ink)' }} itemStyle={{ color: 'var(--ink)' }} />
          <Bar dataKey="income" fill="#2fbf8f" radius={[6, 6, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="expense" fill="#e08a4f" radius={[6, 6, 0, 0]} isAnimationActive={false} />
        </BarChart>
      )}
    </ChartFrame>
  );
}

export function DonutChart({ data, total, currency, language }: { data: CategorySpend[]; total: number; currency: string; language: string }) {
  if (!data.length) return <p className="muted py-8 text-center text-sm">Not enough data for this period.</p>;
  return (
    <div className="relative">
      <ChartFrame height={224}>
        {(width) => (
          <PieChart width={width} height={224}>
            <Pie data={data} dataKey="amount" nameKey="name" innerRadius={62} outerRadius={84} paddingAngle={2} stroke="none" isAnimationActive={false} cx="50%" cy="50%">
              {data.map((entry) => <Cell key={entry.categoryId} fill={chartColor(entry.color)} />)}
            </Pie>
            <Tooltip formatter={(value) => formatMoney(Number(value), currency, language)} contentStyle={tooltipStyle} labelStyle={{ color: 'var(--ink)' }} itemStyle={{ color: 'var(--ink)' }} />
          </PieChart>
        )}
      </ChartFrame>
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="muted text-xs">Expenses</div>
          <div className="amount text-sm font-semibold">{formatMoney(total, currency, language)}</div>
        </div>
      </div>
    </div>
  );
}

export function SavingsLine({ data, currency, language }: { data: ChartPoint[]; currency: string; language: string }) {
  return (
    <ChartFrame height={208}>
      {(width) => (
        <LineChart width={width} height={208} data={data}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(value) => formatMoney(Number(value), currency, language)} contentStyle={tooltipStyle} labelStyle={{ color: 'var(--ink)' }} itemStyle={{ color: 'var(--ink)' }} />
          <Line type="monotone" dataKey="savings" stroke="#7eb6ef" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      )}
    </ChartFrame>
  );
}
