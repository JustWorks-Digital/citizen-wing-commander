"use client";

import { Switch } from "@/components/ui/Switch";

/**
 * Bottom-center Z-layer controls for 2D (single active layer) and 3D
 * (multi-layer visibility toggles).
 */

export type CargoGridLayerPadProps = {
  /** 0-based layer indices to show (low → high). */
  layers: readonly number[];
  /**
   * `select`: one active layer (2D). `toggle`: each layer on/off (3D).
   */
  mode: "select" | "toggle";
  /** Active 0-based layer when `mode="select"`. */
  activeLayer?: number;
  onSelectLayer?: (layer: number) => void;
  /** Hidden 0-based layers when `mode="toggle"`. */
  hiddenLayers?: ReadonlySet<number>;
  onToggleLayer?: (layer: number) => void;
  /**
   * Layers with no visible cargo (after legend filters). Disabled in 2D select;
   * still listed so empty Z slots stay visible in the pad.
   */
  emptyLayers?: ReadonlySet<number>;
  ariaLabel?: string;
  className?: string;
};

const BUTTON_BASE =
  "inline-flex size-4 items-center justify-center rounded-[2px] border font-mono text-[0.5rem] tabular-nums transition-colors";
const BUTTON_ON =
  "border-rsi-accent/50 bg-rsi-accent-muted/35 text-rsi-accent";
const BUTTON_OFF =
  "border-rsi-border bg-rsi-bg-deep/95 text-rsi-text-muted hover:border-rsi-border-strong hover:text-rsi-text shadow-rsi-panel";
const BUTTON_EMPTY =
  "cursor-not-allowed border-rsi-border/50 bg-rsi-bg-deep/30 text-rsi-text-muted/35";

export function CargoGridLayerPad({
  layers,
  mode,
  activeLayer = 0,
  onSelectLayer,
  hiddenLayers,
  onToggleLayer,
  emptyLayers,
  ariaLabel = "Z layers",
  className,
}: CargoGridLayerPadProps) {
  if (layers.length === 0) return null;

  return (
    <div
      role={mode === "select" ? "radiogroup" : "group"}
      aria-label={ariaLabel}
      className={[
        "pointer-events-auto absolute bottom-2 left-1.5 z-20 flex max-w-[calc(100%-4.75rem)] flex-nowrap items-center justify-start gap-1 overflow-x-auto sm:left-1/2 sm:max-w-[calc(100%-5.75rem)] sm:-translate-x-1/2 sm:justify-center",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {layers.map((layer) => {
        const label = layer + 1;
        const isEmpty = emptyLayers?.has(layer) ?? false;
        if (mode === "select") {
          const isActive = activeLayer === layer;
          return (
            <button
              key={layer}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={
                isEmpty ? `Layer ${label} (empty)` : `Layer ${label}`
              }
              disabled={isEmpty}
              onClick={() => {
                if (isEmpty) return;
                onSelectLayer?.(layer);
              }}
              className={[
                BUTTON_BASE,
                isEmpty ? BUTTON_EMPTY : isActive ? BUTTON_ON : BUTTON_OFF,
              ].join(" ")}
            >
              {label}
            </button>
          );
        }
        const isOn = !hiddenLayers?.has(layer);
        return (
          <button
            key={layer}
            type="button"
            aria-pressed={isOn}
            aria-label={
              isEmpty ? `Layer ${label} (empty)` : `Layer ${label}`
            }
            disabled={isEmpty}
            onClick={() => {
              if (isEmpty) return;
              onToggleLayer?.(layer);
            }}
            className={[
              BUTTON_BASE,
              isEmpty ? BUTTON_EMPTY : isOn ? BUTTON_ON : BUTTON_OFF,
            ].join(" ")}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Legend row: “On grid” label + switch for the bottom layer pad. */
export function CargoGridLayerPadToggle({
  isOn,
  onToggle,
  ariaLabel = "Show layer controls on grid",
  label = "On grid",
}: {
  isOn: boolean;
  onToggle: () => void;
  ariaLabel?: string;
  label?: string;
}) {
  return (
    <Switch
      label={label}
      checked={isOn}
      onCheckedChange={() => onToggle()}
      ariaLabel={ariaLabel}
    />
  );
}
