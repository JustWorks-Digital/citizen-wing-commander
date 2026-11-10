"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { Button } from "./Button";
import { ImageLightbox } from "./ImageLightbox";

const meta = {
  title: "UI/ImageLightbox",
  component: ImageLightbox,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof ImageLightbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    src: "/images/outdoor-freight-elevators/port-tressler.jpg",
    title: "port-tressler.jpg",
    caption: "Port Tressler\n24 SCU Medical Supplies · Everus Harbor → Port Tressler",
    alt: "Outdoor freight elevator at Port Tressler",
    onClose: () => {},
  },
  render: function Render(args) {
    const [open, setOpen] = useState(true);
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="max-w-sm text-center text-sm text-rsi-text-muted">
          Zoom with +/− in the header, click the image, or Ctrl/⌘+scroll.
        </p>
        <Button type="button" onClick={() => setOpen(true)}>
          Open lightbox
        </Button>
        {open ? (
          <ImageLightbox
            {...args}
            onClose={() => {
              setOpen(false);
            }}
          />
        ) : null}
      </div>
    );
  },
};

export const Gallery: Story = {
  args: {
    src: "/images/outdoor-freight-elevators/port-tressler.jpg",
    title: "Contract 1",
    alt: "Contract screenshot 1",
    onClose: () => {},
  },
  render: function Render() {
    const items = [
      {
        src: "/images/outdoor-freight-elevators/port-tressler.jpg",
        title: "contract-1.png",
        caption:
          "Member Rank — Corundum\n12 SCU Corundum · Everus Harbor → Lorville",
        alt: "Contract 1",
      },
      {
        src: "/images/outdoor-freight-elevators/port-tressler.jpg",
        title: "contract-2.png",
        caption:
          "Member Rank — Quartz\n8 SCU Quartz · Everus Harbor → Lorville",
        alt: "Contract 2",
      },
      {
        src: "/images/outdoor-freight-elevators/port-tressler.jpg",
        title: "contract-3.png",
        caption: "Member Rank — Tin\n16 SCU Tin · Everus Harbor → Lorville",
        alt: "Contract 3",
      },
    ];
    const [open, setOpen] = useState(true);
    const [index, setIndex] = useState(0);
    return (
      <div className="flex flex-col items-center gap-3">
        <Button type="button" onClick={() => setOpen(true)}>
          Open gallery
        </Button>
        {open ? (
          <ImageLightbox
            src={items[index]!.src}
            title={items[index]!.title}
            caption={items[index]!.caption}
            alt={items[index]!.alt}
            items={items}
            index={index}
            onIndexChange={setIndex}
            onClose={() => setOpen(false)}
          />
        ) : null}
      </div>
    );
  },
};
