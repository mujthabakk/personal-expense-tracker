import type { SpendAlert } from '@/services/spendAlerts';

export interface AiReview {
  summary: string;
  alerts: string[];
}

interface ReviewInput {
  month: string;
  currency: string;
  income: number;
  expenses: number;
  savings: number;
  investment: number;
  categories: Array<{ name: string; amount: number; percent: number }>;
  alerts: SpendAlert[];
}

export async function reviewSpending(apiKey: string, input: ReviewInput): Promise<AiReview> {
  const key = apiKey.trim();
  if (!key) throw new Error('Add a free Gemini API key in Profile.');

  const prompt = [
    'You are a careful personal-finance assistant. Use only the figures below. Do not invent amounts or purchases.',
    'Reply with JSON only: {"summary":"2 short sentences about how the month was spent, including investment","alerts":["one short warning per unwanted or high spend, naming the item"]}.',
    'If there is no unwanted spending, alerts can be an empty array.',
    JSON.stringify({
      month: input.month,
      currency: input.currency,
      income: input.income,
      expenses: input.expenses,
      savings: input.savings,
      investment: input.investment,
      categories: input.categories.map((item) => ({ name: item.name, amount: item.amount, percent: Math.round(item.percent) })),
      flagged: input.alerts.map((alert) => ({
        title: alert.title,
        detail: alert.detail,
        items: alert.items.map((item) => `${item.label} (${item.category}) ${item.amount}`),
      })),
    }),
  ].join('\n');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
    },
  );
  const body = await response.json() as { error?: { message?: string }; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  if (!response.ok) throw new Error(body.error?.message || 'Gemini could not review this month.');
  const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
  return parseReview(text);
}

function parseReview(text: string): AiReview {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return { summary: text.trim(), alerts: [] };
  const parsed = JSON.parse(text.slice(start, end + 1)) as { summary?: string; alerts?: string[] };
  return {
    summary: String(parsed.summary ?? '').trim(),
    alerts: Array.isArray(parsed.alerts) ? parsed.alerts.map((item) => String(item)).filter(Boolean) : [],
  };
}
