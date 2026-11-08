import type { HTMLAttributes, ReactNode } from "react";

export type PanelProps = HTMLAttributes<HTMLElement> & {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
};

export function Panel({
  title,
  eyebrow,
  children,
  className = "",
  ...props
}: PanelProps) {
  return (
    <section
      className={[
        "rounded-rsi border border-rsi-border bg-rsi-surface/90 shadow-rsi-panel backdrop-blur-sm",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {(eyebrow || title) && (
        <header className="border-b border-rsi-divider px-5 py-4">
          {eyebrow ? (
            <p className="mb-1 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-rsi-accent">
              {eyebrow}
            </p>
          ) : null}
          {title ? (
            <h2 className="text-lg font-semibold tracking-wide text-rsi-text">
              {title}
            </h2>
          ) : null}
        </header>
      )}
      <div className="px-5 py-5 text-rsi-text-secondary">{children}</div>
    </section>
  );
}
