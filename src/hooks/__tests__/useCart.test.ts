import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const mockState = {
  job: null,
  isOpen: false,
  expandedSections: {},
  isLoading: false,
  isSaving: false,
  error: null,
  currentJobId: null,
  getTotalItemCount: vi.fn().mockReturnValue(0),
  getSectionItemCount: vi.fn().mockReturnValue(0),
  openCart: vi.fn(),
  closeCart: vi.fn(),
  toggleCart: vi.fn(),
  toggleSection: vi.fn(),
  setCurrentJob: vi.fn(),
  setCurrentJobId: vi.fn(),
  syncFromJob: vi.fn(),
  updateDeviceContext: vi.fn(),
  updateOwnerEntity: vi.fn(),
  addEntity: vi.fn(),
  updateEntity: vi.fn(),
  deleteEntity: vi.fn(),
  addStory: vi.fn(),
  addStories: vi.fn(),
  updateStory: vi.fn(),
  deleteStory: vi.fn(),
  addCustomEvent: vi.fn(),
  updateCustomEvent: vi.fn(),
  deleteCustomEvent: vi.fn(),
  addTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  createRandomEvents: vi.fn(),
  setError: vi.fn(),
  clearError: vi.fn(),
};

vi.mock("../../stores/cartStore", () => ({
  useCartStore: vi.fn(() => mockState),
}));

describe("useCart hook", () => {
  it("returns job data", async () => {
    const { useCart } = await import("../../hooks/useCart");
    const { result } = renderHook(() => useCart());
    expect(result.current.job).toBeNull();
  });

  it("returns UI state", async () => {
    const { useCart } = await import("../../hooks/useCart");
    const { result } = renderHook(() => useCart());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isSaving).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("returns cart actions", async () => {
    const { useCart } = await import("../../hooks/useCart");
    const { result } = renderHook(() => useCart());
    expect(typeof result.current.openCart).toBe("function");
    expect(typeof result.current.closeCart).toBe("function");
    expect(typeof result.current.toggleCart).toBe("function");
    expect(typeof result.current.toggleSection).toBe("function");
  });

  it("returns entity actions", async () => {
    const { useCart } = await import("../../hooks/useCart");
    const { result } = renderHook(() => useCart());
    expect(typeof result.current.addEntity).toBe("function");
    expect(typeof result.current.updateEntity).toBe("function");
    expect(typeof result.current.deleteEntity).toBe("function");
  });

  it("returns story actions", async () => {
    const { useCart } = await import("../../hooks/useCart");
    const { result } = renderHook(() => useCart());
    expect(typeof result.current.addStory).toBe("function");
    expect(typeof result.current.updateStory).toBe("function");
    expect(typeof result.current.deleteStory).toBe("function");
  });

  it("returns task actions", async () => {
    const { useCart } = await import("../../hooks/useCart");
    const { result } = renderHook(() => useCart());
    expect(typeof result.current.addTask).toBe("function");
    expect(typeof result.current.updateTask).toBe("function");
    expect(typeof result.current.deleteTask).toBe("function");
  });

  it("returns syncCart function", async () => {
    const { useCart } = await import("../../hooks/useCart");
    const { result } = renderHook(() => useCart());
    expect(typeof result.current.syncCart).toBe("function");
    // Call syncCart
    result.current.syncCart({ id: "j1" } as any);
    expect(mockState.syncFromJob).toHaveBeenCalledWith({ id: "j1" });
  });

  it("returns computed values", async () => {
    const { useCart } = await import("../../hooks/useCart");
    const { result } = renderHook(() => useCart());
    expect(result.current.totalItemCount).toBeDefined();
    expect(typeof result.current.getSectionItemCount).toBe("function");
  });
});
