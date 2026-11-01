"use client";

import { useEffect, useRef, useState } from "react";

/** File input for a chart screenshot, with a local preview before upload. */
export function ChartInput({ name = "chart" }: { name?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  // React resets the form after an action returns, which empties the file input;
  // drop the preview too so it never shows a chart that won't be submitted.
  useEffect(() => {
    const form = ref.current?.form;
    const clear = () => {
      setPreview(null);
      setError(null);
    };
    form?.addEventListener("reset", clear);
    return () => form?.removeEventListener("reset", clear);
  }, []);

  return (
    <div className="chart-input">
      <input
        ref={ref}
        type="file"
        name={name}
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={(e) => {
          const f = e.target.files?.[0];
          setError(f && f.size > 4 * 1024 * 1024 ? "Image must be 4 MB or smaller." : null);
          setPreview(f ? URL.createObjectURL(f) : null);
        }}
      />
      <small className="muted">PNG, JPEG, WebP or GIF, up to 4 MB.</small>
      {error && <small className="error">{error}</small>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {preview && <img src={preview} alt="Chart preview" className="chart-preview" />}
    </div>
  );
}
