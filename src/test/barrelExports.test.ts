import { describe, it, expect } from "vitest";

describe("Barrel exports", () => {
  it("types/index", async () => {
    const mod = await import("@/types/index");
    expect(mod).toBeTruthy();
  });

  it("stores/index", async () => {
    const mod = await import("@/stores/index");
    expect(mod).toBeTruthy();
    expect(mod.useCartStore).toBeDefined();
    expect(mod.useJobStore).toBeDefined();
  });

  it("hooks/index", async () => {
    const mod = await import("@/hooks/index");
    expect(mod).toBeTruthy();
  });

  it("contexts/index", async () => {
    const mod = await import("@/contexts/index");
    expect(mod).toBeTruthy();
  });

  it("cart/sections/index", async () => {
    const mod = await import("@/components/cart/sections/index");
    expect(mod).toBeTruthy();
  });

  it("cart/dialogs/index", async () => {
    const mod = await import("@/components/cart/dialogs/index");
    expect(mod).toBeTruthy();
  });

  it("sidebar/index", async () => {
    const mod = await import("@/components/sidebar/index");
    expect(mod).toBeTruthy();
  });

  it("story-chat/index", async () => {
    const mod = await import("@/components/story-chat/index");
    expect(mod).toBeTruthy();
  });

  it("ufdr-runtime/index", async () => {
    const mod = await import("@/components/ufdr-runtime/index");
    expect(mod).toBeTruthy();
  });

  it("step-outputs/index", async () => {
    const mod = await import("@/components/generation/step-outputs/index");
    expect(mod).toBeTruthy();
  });

  it("pages/index", async () => {
    const mod = await import("@/pages/index");
    expect(mod).toBeTruthy();
  });

  it("theme/augmentation", async () => {
    const mod = await import("@/theme/augmentation");
    expect(mod).toBeTruthy();
  });

  it("story-chat/types", async () => {
    const mod = await import("@/components/story-chat/types");
    expect(mod).toBeTruthy();
  });

  it("utils/mockEntityGenerator", async () => {
    const mod = await import("@/utils/mockEntityGenerator");
    expect(mod).toBeTruthy();
  });
});
