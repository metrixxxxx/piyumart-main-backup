// hooks/useSentiment.js
import { useState } from 'react';

export function useSentiment() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const analyze = async (input) => {
    setLoading(true);
    setError(null);

    try {
      const payload = typeof input === 'string' ? { text: input } : input;
      const res = await fetch('/api/sentiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Request failed');

      const data = await res.json();
      setResult(data.analysis || data.result?.[0] || data);
    } catch (err) {
      setError('Failed to analyze sentiment');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, result, loading, error };
}
