import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sponsor — Citizen Wing Commander",
  description: "Citizen Wing Commander is now entering into beta.",
  robots: { index: false, follow: false },
};

export default function SponsorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
