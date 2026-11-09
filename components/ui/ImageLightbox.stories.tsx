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
    title: "Port Tressler",
    alt: "Outdoor freight elevator at Port Tressler",
    onClose: () => {},
  },
  render: function Render(args) {
    const [open, setOpen] = useState(true);
    return (
      <div className="flex flex-col items-center gap-3">
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
        title: "Contract 1 · Corundum",
        alt: "Contract 1",
      },
      {
        src: "/images/outdoor-freight-elevators/port-tressler.jpg",
        title: "Contract 2 · Quartz",
        alt: "Contract 2",
      },
      {
        src: "/images/outdoor-freight-elevators/port-tressler.jpg",
        title: "Contract 3 · Tin",
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
