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
