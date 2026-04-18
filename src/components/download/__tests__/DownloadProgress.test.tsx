/**
 * Tests for DownloadProgress Component
 *
 * Tests the individual download progress UI including:
 * - File name display
 * - Progress bar
 * - Speed and ETA formatting
 * - Pause/Resume/Cancel buttons
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../../../test/utils/test-utils";
import userEvent from "@testing-library/user-event";
import { DownloadProgress } from "../DownloadProgress";
import type { DownloadProgress as DownloadProgressType } from "../../../services/downloadService";

describe("DownloadProgress", () => {
    let user: ReturnType<typeof userEvent.setup>;
    const mockOnPause = vi.fn();
    const mockOnResume = vi.fn();
    const mockOnCancel = vi.fn();

    const createMockDownload = (
        overrides?: Partial<DownloadProgressType>
    ): DownloadProgressType => ({
        downloadId: "download-123",
        fileName: "test-file.ufdr",
        totalBytes: 100 * 1024 * 1024, // 100MB
        downloadedBytes: 0,
        speed: 0,
        eta: 0,
        status: "pending",
        ...overrides,
    });

    beforeEach(() => {
        user = userEvent.setup();
        mockOnPause.mockClear();
        mockOnResume.mockClear();
        mockOnCancel.mockClear();

        // Mock window.confirm for cancel confirmation
        window.confirm = vi.fn(() => true);
    });

    describe("File Name Display", () => {
        it("should display the file name", () => {
            const download = createMockDownload({ fileName: "my-report.ufdr" });

            render(
                <DownloadProgress
                    download={download}
                    onPause={mockOnPause}
                    onResume={mockOnResume}
                    onCancel={mockOnCancel}
                />
            );

            expect(screen.getByText("my-report.ufdr")).toBeInTheDocument();
        });

        it("should display long file names with truncation", () => {
            const longFileName = "very-long-file-name-that-might-overflow.ufdr";
            const download = createMockDownload({ fileName: longFileName });

            render(
                <DownloadProgress
                    download={download}
                    onPause={mockOnPause}
                    onResume={mockOnResume}
                    onCancel={mockOnCancel}
                />
            );

            expect(screen.getByText(longFileName)).toBeInTheDocument();
        });
    });

    describe("Progress Bar", () => {
        it("should display progress bar", () => {
            const download = createMockDownload({
                status: "downloading",
                downloadedBytes: 50 * 1024 * 1024, // 50MB of 100MB
            });

            render(
                <DownloadProgress
                    download={download}
                    onPause={mockOnPause}
                    onResume={mockOnResume}
                    onCancel={mockOnCancel}
                />
            );

            expect(screen.getByTestId("download-progress-bar")).toBeInTheDocument();
        });

        it("should show 0% progress at start", () => {
            const download = createMockDownload({
                status: "pending",
                downloadedBytes: 0,
            });

            render(
                <DownloadProgress
                    download={download}
                    onPause={mockOnPause}
                    onResume={mockOnResume}
                    onCancel={mockOnCancel}
                />
            );

            expect(screen.getByText(/0.0%/)).toBeInTheDocument();
        });

        it("should show correct percentage during download", () => {
            const download = createMockDownload({
                status: "downloading",
                downloadedBytes: 50 * 1024 * 1024, // 50%
            });

            render(
                <DownloadProgress
                    download={download}
                    onPause={mockOnPause}
                    onResume={mockOnResume}
                    onCancel={mockOnCancel}
                />
            );

            expect(screen.getByText(/50.0%/)).toBeInTheDocument();
        });

        it("should show 100% when completed", () => {
            const download = createMockDownload({
                status: "completed",
                downloadedBytes: 100 * 1024 * 1024,
            });

            render(
                <DownloadProgress
                    download={download}
                    onPause={mockOnPause}
                    onResume={mockOnResume}
                    onCancel={mockOnCancel}
                />
            );

            expect(screen.getByText(/100.0%/)).toBeInTheDocument();
        });
    });

    describe("Bytes Display", () => {
        it("should display downloaded and total bytes", () => {
            const download = createMockDownload({
                status: "downloading",
                downloadedBytes: 50 * 1024 * 1024,
                totalBytes: 100 * 1024 * 1024,
            });

            render(
                <DownloadProgress
                    download={download}
                    onPause={mockOnPause}
                    onResume={mockOnResume}
                    onCancel={mockOnCancel}
                />
            );

            // Should show something like "50.00 MB / 100.00 MB"
            expect(screen.getByText(/50\.00 MB/)).toBeInTheDocument();
            expect(screen.getByText(/100\.00 MB/)).toBeInTheDocument();
        });

        it("should format bytes correctly for small files", () => {
            const download = createMockDownload({
                status: "downloading",
                downloadedBytes: 500 * 1024, // 500 KB
                totalBytes: 1024 * 1024, // 1 MB
            });

            render(
                <DownloadProgress
                    download={download}
                    onPause={mockOnPause}
                    onResume={mockOnResume}
                    onCancel={mockOnCancel}
                />
            );

            expect(screen.getByText(/500\.00 KB/)).toBeInTheDocument();
        });

        it("should format bytes correctly for large files", () => {
            const download = createMockDownload({
                status: "downloading",
                downloadedBytes: 5 * 1024 * 1024 * 1024, // 5 GB
                totalBytes: 10 * 1024 * 1024 * 1024, // 10 GB
            });

            render(
                <DownloadProgress
                    download={download}
                    onPause={mockOnPause}
                    onResume={mockOnResume}
                    onCancel={mockOnCancel}
                />
            );

            expect(screen.getByText(/5\.00 GB/)).toBeInTheDocument();
        });
    });

    describe("Speed and Status Display", () => {
        it("should display ETA during active download", () => {
            const download = createMockDownload({
                status: "downloading",
                speed: 10 * 1024 * 1024,
                eta: 120, // 2 minutes
                downloadedBytes: 50 * 1024 * 1024,
            });

            render(
                <DownloadProgress
                    download={download}
                    onPause={mockOnPause}
                    onResume={mockOnResume}
                    onCancel={mockOnCancel}
                />
            );

            // ETA is shown during downloading
            expect(screen.getByText(/2m \d+s remaining/)).toBeInTheDocument();
        });
    });

    describe("ETA Display", () => {
        it("should display ETA during active download", () => {
            const download = createMockDownload({
                status: "downloading",
                speed: 10 * 1024 * 1024,
                eta: 120, // 2 minutes
            });

            render(
                <DownloadProgress
                    download={download}
                    onPause={mockOnPause}
                    onResume={mockOnResume}
                    onCancel={mockOnCancel}
                />
            );

            expect(screen.getByText(/2m \d+s remaining/)).toBeInTheDocument();
        });

        it("should show hours for long ETAs", () => {
            const download = createMockDownload({
                status: "downloading",
                speed: 1024 * 1024,
                eta: 3700, // ~1 hour
            });

            render(
                <DownloadProgress
                    download={download}
                    onPause={mockOnPause}
                    onResume={mockOnResume}
                    onCancel={mockOnCancel}
                />
            );

            expect(screen.getByText(/1h \d+m remaining/)).toBeInTheDocument();
        });

        it("should show 'Calculating...' when speed is 0", () => {
            const download = createMockDownload({
                status: "downloading",
                speed: 0,
                eta: Infinity,
            });

            render(
                <DownloadProgress
                    download={download}
                    onPause={mockOnPause}
                    onResume={mockOnResume}
                    onCancel={mockOnCancel}
                />
            );

            expect(screen.getByText(/Calculating/)).toBeInTheDocument();
        });
    });

    describe("Status Display", () => {
        it("should display 'Starting...' for pending status", () => {
            const download = createMockDownload({ status: "pending" });

            render(
                <DownloadProgress
                    download={download}
                    onPause={mockOnPause}
                    onResume={mockOnResume}
                    onCancel={mockOnCancel}
                />
            );

            expect(screen.getByText(/Starting/)).toBeInTheDocument();
        });

        it("should display 'Paused' for paused status", () => {
            const download = createMockDownload({ status: "paused" });

            render(
                <DownloadProgress
                    download={download}
                    onPause={mockOnPause}
                    onResume={mockOnResume}
                    onCancel={mockOnCancel}
                />
            );

            expect(screen.getByText(/Paused/)).toBeInTheDocument();
        });

        it("should display 'Completed' for completed status", () => {
            const download = createMockDownload({
                status: "completed",
                downloadedBytes: 100 * 1024 * 1024,
            });

            render(
                <DownloadProgress
                    download={download}
                    onPause={mockOnPause}
                    onResume={mockOnResume}
                    onCancel={mockOnCancel}
                />
            );

            expect(screen.getByText(/Completed/)).toBeInTheDocument();
        });

        it("should display error message for failed status", () => {
            const download = createMockDownload({
                status: "failed",
                error: "Network error occurred",
            });

            render(
                <DownloadProgress
                    download={download}
                    onPause={mockOnPause}
                    onResume={mockOnResume}
                    onCancel={mockOnCancel}
                />
            );

            expect(screen.getByText(/Failed: Network error occurred/)).toBeInTheDocument();
        });
    });

    describe("Pause Button", () => {
        it("should show pause button when downloading", () => {
            const download = createMockDownload({ status: "downloading" });

            render(
                <DownloadProgress
                    download={download}
                    onPause={mockOnPause}
                    onResume={mockOnResume}
                    onCancel={mockOnCancel}
                />
            );

            expect(screen.getByTestId("download-pause-btn")).toBeInTheDocument();
        });

        it("should not show pause button when paused", () => {
            const download = createMockDownload({ status: "paused" });

            render(
                <DownloadProgress
                    download={download}
                    onPause={mockOnPause}
                    onResume={mockOnResume}
                    onCancel={mockOnCancel}
                />
            );

            expect(screen.queryByTestId("download-pause-btn")).not.toBeInTheDocument();
        });

        it("should call onPause when pause button is clicked", async () => {
            const download = createMockDownload({ status: "downloading" });

            render(
                <DownloadProgress
                    download={download}
                    onPause={mockOnPause}
                    onResume={mockOnResume}
                    onCancel={mockOnCancel}
                />
            );

            await user.click(screen.getByTestId("download-pause-btn"));
            expect(mockOnPause).toHaveBeenCalledTimes(1);
        });
    });

    describe("Resume Button", () => {
        it("should show resume button when paused", () => {
            const download = createMockDownload({ status: "paused" });

            render(
                <DownloadProgress
                    download={download}
                    onPause={mockOnPause}
                    onResume={mockOnResume}
                    onCancel={mockOnCancel}
                />
            );

            expect(screen.getByTestId("download-resume-btn")).toBeInTheDocument();
        });

        it("should not show resume button when downloading", () => {
            const download = createMockDownload({ status: "downloading" });

            render(
                <DownloadProgress
                    download={download}
                    onPause={mockOnPause}
                    onResume={mockOnResume}
                    onCancel={mockOnCancel}
                />
            );

            expect(screen.queryByTestId("download-resume-btn")).not.toBeInTheDocument();
        });

        it("should call onResume when resume button is clicked", async () => {
            const download = createMockDownload({ status: "paused" });

            render(
                <DownloadProgress
                    download={download}
                    onPause={mockOnPause}
                    onResume={mockOnResume}
                    onCancel={mockOnCancel}
                />
            );

            await user.click(screen.getByTestId("download-resume-btn"));
            expect(mockOnResume).toHaveBeenCalledTimes(1);
        });
    });

    describe("Cancel Button", () => {
        it("should show cancel button when downloading", () => {
            const download = createMockDownload({ status: "downloading" });

            render(
                <DownloadProgress
                    download={download}
                    onPause={mockOnPause}
                    onResume={mockOnResume}
                    onCancel={mockOnCancel}
                />
            );

            expect(screen.getByTestId("download-cancel-btn")).toBeInTheDocument();
        });

        it("should show cancel button when paused", () => {
            const download = createMockDownload({ status: "paused" });

            render(
                <DownloadProgress
                    download={download}
                    onPause={mockOnPause}
                    onResume={mockOnResume}
                    onCancel={mockOnCancel}
                />
            );

            expect(screen.getByTestId("download-cancel-btn")).toBeInTheDocument();
        });

        it("should show cancel button when pending", () => {
            const download = createMockDownload({ status: "pending" });

            render(
                <DownloadProgress
                    download={download}
                    onPause={mockOnPause}
                    onResume={mockOnResume}
                    onCancel={mockOnCancel}
                />
            );

            expect(screen.getByTestId("download-cancel-btn")).toBeInTheDocument();
        });

        it("should not show cancel button when completed", () => {
            const download = createMockDownload({
                status: "completed",
                downloadedBytes: 100 * 1024 * 1024,
            });

            render(
                <DownloadProgress
                    download={download}
                    onPause={mockOnPause}
                    onResume={mockOnResume}
                    onCancel={mockOnCancel}
                />
            );

            expect(screen.queryByTestId("download-cancel-btn")).not.toBeInTheDocument();
        });

        it("should show confirmation dialog when cancel is clicked", async () => {
            const download = createMockDownload({ status: "downloading" });

            render(
                <DownloadProgress
                    download={download}
                    onPause={mockOnPause}
                    onResume={mockOnResume}
                    onCancel={mockOnCancel}
                />
            );

            await user.click(screen.getByTestId("download-cancel-btn"));

            expect(window.confirm).toHaveBeenCalledWith(
                "Are you sure you want to cancel this download? Progress will be lost."
            );
        });

        it("should call onCancel when confirmed", async () => {
            window.confirm = vi.fn(() => true);
            const download = createMockDownload({ status: "downloading" });

            render(
                <DownloadProgress
                    download={download}
                    onPause={mockOnPause}
                    onResume={mockOnResume}
                    onCancel={mockOnCancel}
                />
            );

            await user.click(screen.getByTestId("download-cancel-btn"));
            expect(mockOnCancel).toHaveBeenCalledTimes(1);
        });

        it("should not call onCancel when cancelled", async () => {
            window.confirm = vi.fn(() => false);
            const download = createMockDownload({ status: "downloading" });

            render(
                <DownloadProgress
                    download={download}
                    onPause={mockOnPause}
                    onResume={mockOnResume}
                    onCancel={mockOnCancel}
                />
            );

            await user.click(screen.getByTestId("download-cancel-btn"));
            expect(mockOnCancel).not.toHaveBeenCalled();
        });
    });

    describe("Accessibility", () => {
        it("should have accessible pause button", () => {
            const download = createMockDownload({ status: "downloading" });

            render(
                <DownloadProgress
                    download={download}
                    onPause={mockOnPause}
                    onResume={mockOnResume}
                    onCancel={mockOnCancel}
                />
            );

            expect(screen.getByRole("button", { name: /Pause/i })).toBeInTheDocument();
        });

        it("should have accessible resume button", () => {
            const download = createMockDownload({ status: "paused" });

            render(
                <DownloadProgress
                    download={download}
                    onPause={mockOnPause}
                    onResume={mockOnResume}
                    onCancel={mockOnCancel}
                />
            );

            expect(screen.getByRole("button", { name: /Resume/i })).toBeInTheDocument();
        });

        it("should have accessible cancel button", () => {
            const download = createMockDownload({ status: "downloading" });

            render(
                <DownloadProgress
                    download={download}
                    onPause={mockOnPause}
                    onResume={mockOnResume}
                    onCancel={mockOnCancel}
                />
            );

            expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
        });
    });
});
