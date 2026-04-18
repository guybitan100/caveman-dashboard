import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMetaFinderInit, useMetaFinderOptions, useMetaFinderStatus } from "../useMetaFinder";

vi.mock("../../stores/metafinderStore", () => ({
  useMetaFinderStore: vi.fn((selector) => {
    const state = {
      initialize: vi.fn(),
      isLoading: false,
      isInitialized: true,
      error: null,
      getOptionsForEventType: vi.fn().mockReturnValue({
        languages: [{ code: "en", name: "English" }],
        apps: ["WhatsApp"],
      }),
    };
    return selector ? selector(state) : state;
  }),
}));

describe("useMetaFinderInit", () => {
  it("returns loading state", () => {
    const { result } = renderHook(() => useMetaFinderInit());
    expect(result.current).toHaveProperty("isLoading");
    expect(result.current).toHaveProperty("isInitialized");
    expect(result.current).toHaveProperty("error");
  });
});

describe("useMetaFinderOptions", () => {
  it("returns options for event type", () => {
    const { result } = renderHook(() => useMetaFinderOptions("chat messages"));
    expect(result.current.options).toBeTruthy();
    expect(result.current.isLoading).toBe(false);
  });
});

describe("useMetaFinderStatus", () => {
  it("returns status", () => {
    const { result } = renderHook(() => useMetaFinderStatus());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isInitialized).toBe(true);
    expect(result.current.error).toBeNull();
  });
});
