'use client';

import { useState } from 'react';

import { Button } from '@kit/ui/button';
import { toast } from 'sonner';

type Option = { id: string; option_text: string };

export function PollVoteForm({ pollId, options }: { pollId: string; options: Option[] }) {
  const [selected, setSelected] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!selected) {
      toast.error('Select an option first');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/public/polls/${encodeURIComponent(pollId)}/vote`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          optionId: selected,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        updated?: boolean;
      };

      if (!response.ok) {
        throw new Error(payload.error || 'Unable to submit vote');
      }

      setSubmitted(true);
      toast.success(payload.updated ? 'Vote updated' : 'Vote submitted');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Unable to submit vote');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {options.map((opt) => (
        <label
          key={opt.id}
          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${
            selected === opt.id ? 'border-primary bg-primary/5' : 'border-slate-200'
          }`}
        >
          <input
            type="radio"
            name={`poll-${pollId}`}
            value={opt.id}
            checked={selected === opt.id}
            onChange={() => setSelected(opt.id)}
            className="accent-primary"
          />
          <span className="text-sm text-slate-800">{opt.option_text}</span>
        </label>
      ))}
      <Button size="sm" onClick={handleSubmit} disabled={loading || submitted}>
        {submitted ? 'Thanks for voting' : loading ? 'Submitting…' : 'Vote'}
      </Button>
    </div>
  );
}
