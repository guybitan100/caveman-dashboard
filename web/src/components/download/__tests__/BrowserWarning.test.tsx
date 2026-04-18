/**
 * Tests for BrowserWarning Component
 *
 * Tests the browser incompatibility warning modal that appears
 * when the File System Access API is not supported.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../../../test/utils/test-utils";
import userEvent from "@testing-library/user-event";
import { BrowserWarning } from "../BrowserWarning";

describe("BrowserWarning", () => {
    let user: ReturnType<typeof userEvent.setup>;
    const mockOnClose = vi.fn();

    beforeEach(() => {
        user = userEvent.setup();
        mockOnClose.mockClear();
    });

    describe("Rendering", () => {
        it("should render when open is true", () => {
            render(<BrowserWarning open={true} onClose={mockOnClose} />);

            expect(screen.getByText("Browser Not Supported")).toBeInTheDocument();
        });

        it("should not render when open is false", () => {
            render(<BrowserWarning open={false} onClose={mockOnClose} />);

            expect(
                screen.queryByText("Browser Not Supported")
            ).not.toBeInTheDocument();
        });

        it("should display the correct warning message about Chrome or Edge", () => {
            render(<BrowserWarning open={true} onClose={mockOnClose} />);

            expect(
                screen.getByText(/Downloading large files requires Chrome or Microsoft Edge/i)
            ).toBeInTheDocument();
        });

        it("should display explanation about File System Access API", () => {
            render(<BrowserWarning open={true} onClose={mockOnClose} />);

            expect(
                screen.getByText(/File System Access API/i)
            ).toBeInTheDocument();
        });

        it("should display the warning icon", () => {
            render(<BrowserWarning open={true} onClose={mockOnClose} />);

            // The WarningAmberIcon should be present (part of the header)
            expect(screen.getByTestId("WarningAmberIcon")).toBeInTheDocument();
        });
    });

    describe("Get Chrome Link", () => {
        it("should have a 'Get Chrome' button", () => {
            render(<BrowserWarning open={true} onClose={mockOnClose} />);

            expect(
                screen.getByRole("button", { name: /Get Chrome/i })
            ).toBeInTheDocument();
        });

        it("should link to Chrome download page", () => {
            render(<BrowserWarning open={true} onClose={mockOnClose} />);

            const link = screen.getByRole("link", { name: /Get Chrome/i });
            expect(link).toHaveAttribute("href", "https://www.google.com/chrome/");
        });

        it("should open Chrome link in new tab", () => {
            render(<BrowserWarning open={true} onClose={mockOnClose} />);

            const link = screen.getByRole("link", { name: /Get Chrome/i });
            expect(link).toHaveAttribute("target", "_blank");
            expect(link).toHaveAttribute("rel", "noopener noreferrer");
        });
    });

    describe("Cancel Button", () => {
        it("should have a Cancel button", () => {
            render(<BrowserWarning open={true} onClose={mockOnClose} />);

            expect(
                screen.getByRole("button", { name: /Cancel/i })
            ).toBeInTheDocument();
        });

        it("should call onClose when Cancel button is clicked", async () => {
            render(<BrowserWarning open={true} onClose={mockOnClose} />);

            const cancelButton = screen.getByRole("button", { name: /Cancel/i });
            await user.click(cancelButton);

            expect(mockOnClose).toHaveBeenCalledTimes(1);
        });
    });

    describe("Close Button", () => {
        it("should have a close button with aria-label", () => {
            render(<BrowserWarning open={true} onClose={mockOnClose} />);

            expect(
                screen.getByRole("button", { name: /Close/i })
            ).toBeInTheDocument();
        });

        it("should call onClose when close button is clicked", async () => {
            render(<BrowserWarning open={true} onClose={mockOnClose} />);

            const closeButton = screen.getByRole("button", { name: /Close/i });
            await user.click(closeButton);

            expect(mockOnClose).toHaveBeenCalledTimes(1);
        });
    });

    describe("Dialog Behavior", () => {
        it("should call onClose when clicking outside the dialog", async () => {
            render(<BrowserWarning open={true} onClose={mockOnClose} />);

            // Click on the backdrop (outside the dialog)
            const backdrop = document.querySelector(".MuiBackdrop-root");
            if (backdrop) {
                await user.click(backdrop);
                expect(mockOnClose).toHaveBeenCalled();
            }
        });
    });

    describe("Accessibility", () => {
        it("should have accessible dialog role", () => {
            render(<BrowserWarning open={true} onClose={mockOnClose} />);

            expect(screen.getByRole("dialog")).toBeInTheDocument();
        });

        it("should have accessible heading", () => {
            render(<BrowserWarning open={true} onClose={mockOnClose} />);

            expect(screen.getByText("Browser Not Supported")).toBeInTheDocument();
        });
    });
});
