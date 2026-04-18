/**
 * Tests for RightSidebar - Job Status Display Tests
 *
 * Priority: HIGH
 * These tests verify that job status is correctly displayed and
 * status-dependent UI elements (Generate, Processing, Download) render correctly.
 * 
 * Note: Job status is derived from jobStore via useSelectedJobStatus hook.
 * The cartStore no longer stores jobStatus directly.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RightSidebar } from "../RightSidebar";
import { useCartStore } from "../../../stores/cartStore";
import { useJobStore } from "../../../stores/jobStore";
import { useDownloadStore } from "../../../stores/downloadStore";
import { renderWithProviders } from "../../../test/utils/test-utils";
import type { GenerationJob, StoriesGraph } from "../../../types/cart";
import type { JobStatus } from "../../../types/job";

// Mock the child components to isolate RightSidebar testing
vi.mock("../sections/CaseDataSection", () => ({
    CaseDataSection: () => <div data-testid="case-data-section">CaseDataSection</div>,
}));

vi.mock("../sections/ExtractionPanel", () => ({
    ExtractionPanel: () => <div data-testid="extraction-panel">ExtractionPanel</div>,
}));

vi.mock("../../download/BrowserWarning", () => ({
    BrowserWarning: ({ open }: { open: boolean }) =>
        open ? <div data-testid="browser-warning">BrowserWarning</div> : null,
}));

// Mock jobsApi
vi.mock("../../../api/jobsApi", () => ({
    jobsApi: {
        runJob: vi.fn().mockResolvedValue({}),
    },
}));

// Mock downloadService
vi.mock("../../../services/downloadService", () => ({
    downloadService: {
        isSupported: vi.fn().mockReturnValue(true),
        startDownload: vi.fn().mockResolvedValue(undefined),
    },
}));

// Helper to create mock stories graph
const createEmptyStoriesGraph = (): StoriesGraph => ({
    directed: true,
    multigraph: false,
    graph: {},
    nodes: [],
    edges: [],
});

// Helper to create mock job data
const createMockJob = (overrides?: Partial<GenerationJob>): GenerationJob => ({
    job_id: "job-123",
    name: "Test Job",
    status: "Draft",
    context: {
        device: {
            manufacturer: "Apple",
            name: "iPhone 12",
            os: "ios",
        },
        start_date: "2024-01-01",
        end_date: "2024-01-31",
        country_info: {
            name: "United States",
            alpha2: "US",
            alpha3: "USA",
            timezones: ["America/New_York"],
            languages: ["en"],
        },
    },
    device_info: [],
    owner_entity: null,
    entities: [],
    stories: createEmptyStoriesGraph(),
    custom_events: [],
    tasks: [],
    ...overrides,
});

/**
 * Helper to set up a job with a specific status.
 * This simulates the new architecture where:
 * 1. Job is added to jobStore with its status
 * 2. Job is selected in jobStore
 * 3. Full job data is synced to cartStore
 * 4. Cart is opened
 */
const setupJobWithStatus = (mockJob: GenerationJob, status: JobStatus) => {
    const jobStore = useJobStore.getState();
    const cartStore = useCartStore.getState();

    // Add job to jobStore with status (simulating sidebar data)
    jobStore.setJobs([{
        id: mockJob.job_id,
        name: mockJob.name,
        status: status,
        timestamp: new Date().toISOString(),
        user: "test@example.com",
    }], 1);

    // Select the job
    jobStore.selectJob(mockJob.job_id);

    // Sync full job data to cart
    cartStore.syncFromJob(mockJob);
    cartStore.openCart();
};

describe("RightSidebar - Job Status Display Tests", () => {
    beforeEach(() => {
        // Reset all stores before each test
        const cartStore = useCartStore.getState();
        cartStore.setCurrentJob(null);
        cartStore.closeCart();
        cartStore.clearError();

        const jobStore = useJobStore.getState();
        jobStore.setJobs([], 0);
        jobStore.selectJob(null);

        // Reset download store by setting downloads to empty object
        useDownloadStore.setState({ downloads: {} });

        vi.clearAllMocks();
    });

    describe("Status-based UI Rendering", () => {
        it("should show Generate button when job status is Draft", () => {
            const mockJob = createMockJob();
            setupJobWithStatus(mockJob, "Draft");

            renderWithProviders(<RightSidebar />);

            expect(screen.getByTestId("generate-button")).toBeInTheDocument();
            expect(screen.queryByTestId("processing-indicator")).not.toBeInTheDocument();
            expect(screen.queryByTestId("download-button")).not.toBeInTheDocument();
        });

        it("should show Processing indicator when job status is Pending", () => {
            const mockJob = createMockJob();
            setupJobWithStatus(mockJob, "Pending");

            renderWithProviders(<RightSidebar />);

            expect(screen.getByTestId("processing-indicator")).toBeInTheDocument();
            expect(screen.getByText("Pending...")).toBeInTheDocument();
            expect(screen.queryByTestId("generate-button")).not.toBeInTheDocument();
            expect(screen.queryByTestId("download-button")).not.toBeInTheDocument();
        });

        it("should show Processing indicator when job status is Generating", () => {
            const mockJob = createMockJob();
            setupJobWithStatus(mockJob, "Generating");

            renderWithProviders(<RightSidebar />);

            expect(screen.getByTestId("processing-indicator")).toBeInTheDocument();
            expect(screen.getByText("Generating...")).toBeInTheDocument();
        });

        it("should show Processing indicator when job status is Converting", () => {
            const mockJob = createMockJob();
            setupJobWithStatus(mockJob, "Converting");

            renderWithProviders(<RightSidebar />);

            expect(screen.getByTestId("processing-indicator")).toBeInTheDocument();
            expect(screen.getByText("Converting...")).toBeInTheDocument();
        });

        it("should show Processing indicator when job status is Finalizing", () => {
            const mockJob = createMockJob();
            setupJobWithStatus(mockJob, "Finalizing");

            renderWithProviders(<RightSidebar />);

            expect(screen.getByTestId("processing-indicator")).toBeInTheDocument();
            expect(screen.getByText("Finalizing...")).toBeInTheDocument();
        });

        it("should show Download button when job status is Done", () => {
            const mockJob = createMockJob();
            setupJobWithStatus(mockJob, "Done");

            renderWithProviders(<RightSidebar />);

            expect(screen.getByTestId("download-button")).toBeInTheDocument();
            expect(screen.queryByTestId("generate-button")).not.toBeInTheDocument();
            expect(screen.queryByTestId("processing-indicator")).not.toBeInTheDocument();
        });

        it("should show no action buttons when job status is Failed", () => {
            const mockJob = createMockJob();
            setupJobWithStatus(mockJob, "Failed");

            renderWithProviders(<RightSidebar />);

            // Failed jobs show no action buttons (not Draft, not processing, not Done)
            expect(screen.queryByTestId("generate-button")).not.toBeInTheDocument();
            expect(screen.queryByTestId("processing-indicator")).not.toBeInTheDocument();
            expect(screen.queryByTestId("download-button")).not.toBeInTheDocument();
        });

        it("should show no action buttons when job status is Cancelled", () => {
            const mockJob = createMockJob();
            setupJobWithStatus(mockJob, "Cancelled");

            renderWithProviders(<RightSidebar />);

            expect(screen.queryByTestId("generate-button")).not.toBeInTheDocument();
            expect(screen.queryByTestId("processing-indicator")).not.toBeInTheDocument();
            expect(screen.queryByTestId("download-button")).not.toBeInTheDocument();
        });
    });

    describe("Status Updates on Actions", () => {
        it("should update status to Pending when Generate is clicked", async () => {
            const user = userEvent.setup();
            const mockJob = createMockJob();
            setupJobWithStatus(mockJob, "Draft");

            const { jobsApi } = await import("../../../api/jobsApi");
            vi.mocked(jobsApi.runJob).mockResolvedValue({
                ...mockJob,
                status: "Pending",
            });

            renderWithProviders(<RightSidebar />);

            const generateButton = screen.getByTestId("generate-button");
            await user.click(generateButton);

            // Status is now updated in jobStore, not cartStore
            await waitFor(() => {
                const job = useJobStore.getState().jobs.find(j => j.id === mockJob.job_id);
                expect(job?.status).toBe("Pending");
            });
        });
    });

    describe("Job Name Display", () => {
        it("should display job name in header", () => {
            const mockJob = createMockJob({ name: "My Custom Job" });
            setupJobWithStatus(mockJob, "Draft");

            renderWithProviders(<RightSidebar />);

            expect(screen.getByTestId("cart-job-name")).toHaveTextContent("My Custom Job");
        });
    });

    describe("Sidebar Visibility", () => {
        it("should not render when cart is closed", () => {
            const cartStore = useCartStore.getState();
            cartStore.closeCart();

            renderWithProviders(<RightSidebar />);

            expect(screen.queryByTestId("cart-sidebar")).not.toBeInTheDocument();
        });

        it("should render when cart is open", () => {
            const mockJob = createMockJob();
            setupJobWithStatus(mockJob, "Draft");

            renderWithProviders(<RightSidebar />);

            expect(screen.getByTestId("cart-sidebar")).toBeInTheDocument();
        });
    });

    describe("Status Transition Scenarios", () => {
        it("should correctly transition from Draft to Done and show Download", () => {
            const mockJob = createMockJob();
            const jobStore = useJobStore.getState();

            // Start with Draft
            setupJobWithStatus(mockJob, "Draft");

            const { rerender } = renderWithProviders(<RightSidebar />);

            expect(screen.getByTestId("generate-button")).toBeInTheDocument();

            // Transition to Done (simulating job completion via jobStore)
            jobStore.updateJobStatus(mockJob.job_id, "Done");

            rerender(<RightSidebar />);

            expect(screen.getByTestId("download-button")).toBeInTheDocument();
            expect(screen.queryByTestId("generate-button")).not.toBeInTheDocument();
        });

        it("should correctly show processing states during generation", () => {
            const mockJob = createMockJob();
            const jobStore = useJobStore.getState();

            setupJobWithStatus(mockJob, "Pending");

            const { rerender } = renderWithProviders(<RightSidebar />);

            expect(screen.getByText("Pending...")).toBeInTheDocument();

            // Transition to Generating
            jobStore.updateJobStatus(mockJob.job_id, "Generating");

            rerender(<RightSidebar />);

            expect(screen.getByText("Generating...")).toBeInTheDocument();

            // Transition to Converting
            jobStore.updateJobStatus(mockJob.job_id, "Converting");

            rerender(<RightSidebar />);

            expect(screen.getByText("Converting...")).toBeInTheDocument();

            // Transition to Finalizing
            jobStore.updateJobStatus(mockJob.job_id, "Finalizing");

            rerender(<RightSidebar />);

            expect(screen.getByText("Finalizing...")).toBeInTheDocument();

            // Finally Done
            jobStore.updateJobStatus(mockJob.job_id, "Done");

            rerender(<RightSidebar />);

            expect(screen.getByTestId("download-button")).toBeInTheDocument();
        });
    });

    describe("Regression: Job Status from Sidebar Selection", () => {
        it("should derive jobStatus from jobStore, not from job data", () => {
            // This test verifies the architecture: jobStatus is derived from jobStore
            // via useSelectedJobStatus hook, not stored in cartStore
            const mockJob = createMockJob();

            // Set up job with Done status (simulating selection of a Done job from sidebar)
            setupJobWithStatus(mockJob, "Done");

            renderWithProviders(<RightSidebar />);

            // Should show Download button because status is Done in jobStore
            expect(screen.getByTestId("download-button")).toBeInTheDocument();
            expect(screen.queryByTestId("generate-button")).not.toBeInTheDocument();
        });

        it("should maintain correct status when switching between jobs", () => {
            const draftJob = createMockJob({ job_id: "job-draft", name: "Draft Job" });
            const doneJob = createMockJob({ job_id: "job-done", name: "Done Job" });
            const jobStore = useJobStore.getState();
            const cartStore = useCartStore.getState();

            // Set up both jobs in store
            jobStore.setJobs([
                {
                    id: "job-draft",
                    name: "Draft Job",
                    status: "Draft",
                    timestamp: new Date().toISOString(),
                    user: "test@example.com",
                },
                {
                    id: "job-done",
                    name: "Done Job",
                    status: "Done",
                    timestamp: new Date().toISOString(),
                    user: "test@example.com",
                },
            ], 2);

            // Select draft job
            jobStore.selectJob("job-draft");
            cartStore.syncFromJob(draftJob);
            cartStore.openCart();

            const { rerender } = renderWithProviders(<RightSidebar />);

            expect(screen.getByTestId("generate-button")).toBeInTheDocument();
            expect(screen.getByTestId("cart-job-name")).toHaveTextContent("Draft Job");

            // Switch to done job
            jobStore.selectJob("job-done");
            cartStore.syncFromJob(doneJob);

            rerender(<RightSidebar />);

            expect(screen.getByTestId("download-button")).toBeInTheDocument();
            expect(screen.getByTestId("cart-job-name")).toHaveTextContent("Done Job");
        });
    });
});
