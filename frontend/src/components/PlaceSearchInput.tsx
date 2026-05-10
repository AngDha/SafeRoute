"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAutocomplete } from "@/lib/api";
import type { AutocompletePrediction } from "@/types/route";

const sessionToken = (): string => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

type Props = {
  id: string;
  letter: string;
  value: string;
  onChangeValue: (v: string) => void;
  placeId: string | null;
  onPlaceIdChange: (id: string | null) => void;
  placeholder?: string;
  accent: "emerald" | "rose";
};

export default function PlaceSearchInput({
  id,
  letter,
  value,
  onChangeValue,
  placeId,
  onPlaceIdChange,
  placeholder = "Search for a place",
  accent,
}: Props) {
  const sessionRef = useRef<string>(sessionToken());
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [predictions, setPredictions] = useState<AutocompletePrediction[]>([]);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ring =
    accent === "emerald"
      ? "focus-within:border-emerald-400 focus-within:ring-emerald-400"
      : "focus-within:border-rose-400 focus-within:ring-rose-400";
  const badge = accent === "emerald" ? "text-emerald-600" : "text-rose-600";

  const runFetch = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setPredictions([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const list = await fetchAutocomplete(q, sessionRef.current);
        setPredictions(list);
        setHighlight(-1);
      } catch {
        setPredictions([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setPredictions([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void runFetch(value);
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, runFetch]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (p: AutocompletePrediction) => {
    onChangeValue(p.description);
    onPlaceIdChange(p.place_id);
    setOpen(false);
    setPredictions([]);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || predictions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % predictions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? predictions.length - 1 : h - 1));
    } else if (e.key === "Enter" && highlight >= 0) {
      e.preventDefault();
      pick(predictions[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <div
        className={`flex gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border focus-within:ring-1 ${ring}`}
      >
        <span className={`select-none pt-1 text-sm font-bold ${badge}`}>{letter}</span>
        <input
          id={id}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onChangeValue(e.target.value);
            onPlaceIdChange(null);
            setOpen(true);
          }}
          onFocus={() => {
            if (value.trim().length >= 2) setOpen(true);
          }}
          onBlur={() => {
            setTimeout(() => setOpen(false), 180);
          }}
          onKeyDown={onKeyDown}
        />
        {loading ? <span className="shrink-0 self-center text-[10px] text-slate-400">…</span> : null}
        {placeId ? (
          <span className="shrink-0 self-center rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] text-slate-600">
            pinned
          </span>
        ) : null}
      </div>
      {open && predictions.length > 0 ? (
        <ul
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg"
          role="listbox"
          onMouseDown={(e) => e.preventDefault()}
        >
          {predictions.map((p, i) => (
            <li key={p.place_id}>
              <button
                type="button"
                role="option"
                aria-selected={i === highlight}
                className={`flex w-full flex-col items-start px-3 py-2 text-left hover:bg-slate-50 ${
                  i === highlight ? "bg-slate-50" : ""
                }`}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(p)}
              >
                <span className="font-medium text-slate-900">{p.main_text ?? p.description}</span>
                {p.secondary_text ? (
                  <span className="text-xs text-slate-500">{p.secondary_text}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
