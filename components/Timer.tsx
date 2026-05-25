"use client";

import { useEffect, useState } from "react";

interface Props {
  startedAt: number;
  durationMs: number;
  onExpire?: () => void;
}

export default function Timer({ startedAt, durationMs, onExpire }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = now - startedAt;
  const remaining = Math.max(0, durationMs - elapsed);

  useEffect(() => {
    if (remaining === 0 && onExpire) onExpire();
  }, [remaining, onExpire]);

  const total = Math.floor(remaining / 1000);
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;

  const danger = remaining < 5 * 60 * 1000;

  return (
    <span
      className={`font-mono text-lg tabular-nums ${
        danger ? "text-red-400" : "text-zinc-200"
      }`}
    >
      {hh > 0 ? `${hh}:` : ""}
      {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
    </span>
  );
}
