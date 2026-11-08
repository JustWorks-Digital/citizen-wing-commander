import type { Preview } from "@storybook/nextjs-vite";
import "../app/globals.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: "rsi-bg",
      values: [
        { name: "rsi-bg", value: "#0a1d29" },
        { name: "rsi-surface", value: "#1c2737" },
        { name: "rsi-bg-deep", value: "#06141d" },
      ],
    },
    layout: "padded",
    a11y: {
      test: "todo",
    },
  },
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-rsi-bg p-6 font-sans text-rsi-text antialiased">
        <Story />
      </div>
    ),
  ],
};

export default preview;
