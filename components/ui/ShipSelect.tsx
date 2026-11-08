"use client";

export type ShipSelectOption = {
  slug: string;
  name: string;
  cargoScu: number;
};

export type ShipSelectProps = {
  valueSlug: string | null;
  options: ShipSelectOption[];
  onChange: (slug: string | null) => void;
  label?: string;
  disabled?: boolean;
  isLoading?: boolean;
  error?: string | null;
};

export function ShipSelect({
  valueSlug,
  options,
  onChange,
  label = "Ship",
  disabled = false,
  isLoading = false,
  error = null,
}: ShipSelectProps) {
  return (
    <div className="w-full max-w-md">
      <label
        htmlFor="session-ship-select"
        className="mb-1 block font-mono text-[0.65rem] uppercase tracking-[0.18em] text-rsi-text-muted"
      >
        {label}
      </label>
      <select
        id="session-ship-select"
        disabled={disabled || isLoading || options.length === 0}
        value={valueSlug ?? ""}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next.length > 0 ? next : null);
        }}
        className={[
          "w-full rounded-rsi border border-rsi-border bg-rsi-bg-deep/70 px-3 py-2 text-sm text-rsi-text shadow-rsi-panel",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
          "disabled:cursor-not-allowed disabled:opacity-60",
        ].join(" ")}
      >
        <option value="">
          {isLoading ? "Loading ships…" : "Select a ship…"}
        </option>
        {options.map((ship) => (
          <option key={ship.slug} value={ship.slug}>
            {ship.name} · {ship.cargoScu} SCU
          </option>
        ))}
      </select>
      {error ? (
        <p className="mt-1 text-sm text-rsi-warn">{error}</p>
      ) : null}
      {!error && !isLoading && options.length === 0 ? (
        <p className="mt-1 text-sm text-rsi-text-muted">
          No selectable ships in the database. Run{" "}
          <span className="font-mono text-rsi-text-secondary">
            npm run db:sync-ships
          </span>
          .
        </p>
      ) : null}
    </div>
  );
}
