"use client";

import { useState } from "react";

// Repeatable line-item rows; each submits desc[], qty[], price[].
export function QuoteLineEditor() {
  const [rows, setRows] = useState([0]);
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row} className="flex gap-2">
          <input
            name="desc"
            placeholder="Description"
            className="input flex-1"
          />
          <input
            name="qty"
            type="number"
            min="1"
            defaultValue={1}
            className="input w-20"
            aria-label="Quantity"
          />
          <input
            name="price"
            type="number"
            step="0.01"
            min="0"
            placeholder="Unit price"
            className="input w-32"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((r) => [...r, r.length])}
        className="text-sm text-brand-600 hover:underline"
      >
        + Add line
      </button>
    </div>
  );
}
