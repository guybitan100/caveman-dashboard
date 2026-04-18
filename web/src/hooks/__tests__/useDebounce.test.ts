import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useDebounce } from "../useJobs";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("returns initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("initial", 300));
    expect(result.current).toBe("initial");
  });

  it("debounces value changes", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "first", delay: 300 } }
    );

    expect(result.current).toBe("first");

    rerender({ value: "second", delay: 300 });
    expect(result.current).toBe("first"); // Not yet changed

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe("second");
  });

  it("resets timer on rapid changes", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "a", delay: 300 } }
    );

    rerender({ value: "b", delay: 300 });
    act(() => { vi.advanceTimersByTime(100); });

    rerender({ value: "c", delay: 300 });
    act(() => { vi.advanceTimersByTime(100); });

    expect(result.current).toBe("a"); // Still original

    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBe("c"); // Last value
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
