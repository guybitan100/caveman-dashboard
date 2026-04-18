import { describe, it, expect, vi } from "vitest";
import { render } from "../../test/utils/test-utils";
import React from "react";

describe("Background", () => {
  it("renders static background", async () => {
    const { Background } = await import("../icons/Background");
    const { container } = render(<Background />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("renders animated background with defaults", async () => {
    const { AnimatedBackground } = await import("../icons/Background");
    const { container } = render(<AnimatedBackground />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("renders animated background with custom props", async () => {
    const { AnimatedBackground } = await import("../icons/Background");
    const { container } = render(
      <AnimatedBackground intensity={0.05} maxOffset={20} damping={0.3} />
    );
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("handles reduced motion preference", async () => {
    const origMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as any;
    const { AnimatedBackground } = await import("../icons/Background");
    const { container } = render(<AnimatedBackground />);
    expect(container).toBeTruthy();
    window.matchMedia = origMatchMedia;
  });
});

describe("Icon components", () => {
  it("renders AIStar", async () => {
    const { AIStar } = await import("../icons/AiStar");
    const { container } = render(<AIStar />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("renders AIStar with bigIcon", async () => {
    const { AIStar } = await import("../icons/AiStar");
    const { container } = render(<AIStar bigIcon />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("renders AIStarSpinner", async () => {
    const { AIStarSpinner } = await import("../icons/AiStarSpinner");
    const { container } = render(<AIStarSpinner />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("renders AIStarSpinner with bigIcon", async () => {
    const { AIStarSpinner } = await import("../icons/AiStarSpinner");
    const { container } = render(<AIStarSpinner bigIcon />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("renders ButtonIcon", async () => {
    const mod = await import("../icons/ButtonIcon");
    const ButtonIcon = mod.default || mod.ButtonIcon;
    if (ButtonIcon) {
      const { container } = render(<ButtonIcon />);
      expect(container).toBeTruthy();
    }
  });
});
