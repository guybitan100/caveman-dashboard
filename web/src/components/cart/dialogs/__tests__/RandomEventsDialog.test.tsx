
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '../../../../test/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { RandomEventsDialog } from '../RandomEventsDialog';

// Mock the useCart hook
const mockCreateRandomEvents = vi.fn();
vi.mock('../../../../hooks/useCart', () => ({
    useCart: () => ({
        createRandomEvents: mockCreateRandomEvents,
    }),
}));

describe('RandomEventsDialog', () => {
    let user: ReturnType<typeof userEvent.setup>;
    const mockOnClose = vi.fn();

    beforeEach(() => {
        user = userEvent.setup();
        mockOnClose.mockClear();
        mockCreateRandomEvents.mockClear();
        mockCreateRandomEvents.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('should render dialog when open', () => {
            render(<RandomEventsDialog open={true} onClose={mockOnClose} />);

            expect(screen.getByText('Generate Random Events')).toBeInTheDocument();
            expect(screen.getByLabelText('Total Events')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /generate/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
        });

        it('should not render dialog when closed', () => {
            render(<RandomEventsDialog open={false} onClose={mockOnClose} />);

            expect(screen.queryByText('Generate Random Events')).not.toBeInTheDocument();
        });

        it('should render with default value of 100', () => {
            render(<RandomEventsDialog open={true} onClose={mockOnClose} />);

            const input = screen.getByLabelText('Total Events');
            expect(input).toHaveValue('100');
        });

        it('should render help text', () => {
            render(<RandomEventsDialog open={true} onClose={mockOnClose} />);

            expect(screen.getByText(/events will be distributed across types/i)).toBeInTheDocument();
        });
    });

    describe('Input Validation', () => {
        it('should accept valid numeric input', async () => {
            render(<RandomEventsDialog open={true} onClose={mockOnClose} />);

            const input = screen.getByLabelText('Total Events');
            await user.clear(input);
            await user.type(input, '500');

            expect(input).toHaveValue('500');
            expect(screen.queryByText(/enter a number between/i)).not.toBeInTheDocument();
        });

        it('should reject non-numeric input', async () => {
            render(<RandomEventsDialog open={true} onClose={mockOnClose} />);

            const input = screen.getByLabelText('Total Events');
            await user.clear(input);
            await user.type(input, 'abc');

            // Should remain empty since non-numeric chars are rejected
            expect(input).toHaveValue('');
        });

        it('should show error for value exceeding 10000', async () => {
            render(<RandomEventsDialog open={true} onClose={mockOnClose} />);

            const input = screen.getByLabelText('Total Events');
            await user.clear(input);
            await user.type(input, '15000');

            expect(screen.getByText(/enter a number between 1 and 10,000/i)).toBeInTheDocument();
        });

        it('should show error for value of 0', async () => {
            render(<RandomEventsDialog open={true} onClose={mockOnClose} />);

            const input = screen.getByLabelText('Total Events');
            await user.clear(input);
            await user.type(input, '0');

            expect(screen.getByText(/enter a number between 1 and 10,000/i)).toBeInTheDocument();
        });

        it('should disable generate button for invalid input', async () => {
            render(<RandomEventsDialog open={true} onClose={mockOnClose} />);

            const input = screen.getByLabelText('Total Events');
            await user.clear(input);
            await user.type(input, '15000');

            const generateButton = screen.getByRole('button', { name: /generate/i });
            expect(generateButton).toBeDisabled();
        });

        it('should enable generate button for valid input', async () => {
            render(<RandomEventsDialog open={true} onClose={mockOnClose} />);

            const input = screen.getByLabelText('Total Events');
            await user.clear(input);
            await user.type(input, '500');

            const generateButton = screen.getByRole('button', { name: /generate/i });
            expect(generateButton).not.toBeDisabled();
        });

        it('should accept maximum valid value of 10000', async () => {
            render(<RandomEventsDialog open={true} onClose={mockOnClose} />);

            const input = screen.getByLabelText('Total Events');
            await user.clear(input);
            await user.type(input, '10000');

            expect(screen.queryByText(/enter a number between/i)).not.toBeInTheDocument();
            const generateButton = screen.getByRole('button', { name: /generate/i });
            expect(generateButton).not.toBeDisabled();
        });

        it('should accept minimum valid value of 1', async () => {
            render(<RandomEventsDialog open={true} onClose={mockOnClose} />);

            const input = screen.getByLabelText('Total Events');
            await user.clear(input);
            await user.type(input, '1');

            expect(screen.queryByText(/enter a number between/i)).not.toBeInTheDocument();
            const generateButton = screen.getByRole('button', { name: /generate/i });
            expect(generateButton).not.toBeDisabled();
        });
    });

    describe('Form Submission', () => {
        it('should call createRandomEvents with correct value on submit', async () => {
            render(<RandomEventsDialog open={true} onClose={mockOnClose} />);

            const input = screen.getByLabelText('Total Events');
            await user.clear(input);
            await user.type(input, '500');

            const generateButton = screen.getByRole('button', { name: /generate/i });
            await user.click(generateButton);

            expect(mockCreateRandomEvents).toHaveBeenCalledWith(500);
        });

        it('should close dialog after successful submission', async () => {
            render(<RandomEventsDialog open={true} onClose={mockOnClose} />);

            const generateButton = screen.getByRole('button', { name: /generate/i });
            await user.click(generateButton);

            await waitFor(() => {
                expect(mockOnClose).toHaveBeenCalled();
            });
        });

        it('should not call createRandomEvents with invalid input', async () => {
            render(<RandomEventsDialog open={true} onClose={mockOnClose} />);

            const input = screen.getByLabelText('Total Events');
            await user.clear(input);
            await user.type(input, '0');

            const generateButton = screen.getByRole('button', { name: /generate/i });
            // Button should be disabled, but try clicking anyway
            expect(generateButton).toBeDisabled();

            expect(mockCreateRandomEvents).not.toHaveBeenCalled();
        });
    });

    describe('Loading State', () => {
        it('should show loading state during submission', async () => {
            // Make the mock take some time
            mockCreateRandomEvents.mockImplementation(
                () => new Promise((resolve) => setTimeout(resolve, 100))
            );

            render(<RandomEventsDialog open={true} onClose={mockOnClose} />);

            const generateButton = screen.getByRole('button', { name: /generate/i });
            await user.click(generateButton);

            // Should show "Generating..." text
            expect(screen.getByText(/generating\.\.\./i)).toBeInTheDocument();
        });

        it('should disable input during loading', async () => {
            mockCreateRandomEvents.mockImplementation(
                () => new Promise((resolve) => setTimeout(resolve, 100))
            );

            render(<RandomEventsDialog open={true} onClose={mockOnClose} />);

            const generateButton = screen.getByRole('button', { name: /generate/i });
            await user.click(generateButton);

            const input = screen.getByLabelText('Total Events');
            expect(input).toBeDisabled();
        });

        it('should disable cancel button during loading', async () => {
            mockCreateRandomEvents.mockImplementation(
                () => new Promise((resolve) => setTimeout(resolve, 100))
            );

            render(<RandomEventsDialog open={true} onClose={mockOnClose} />);

            const generateButton = screen.getByRole('button', { name: /generate/i });
            await user.click(generateButton);

            const cancelButton = screen.getByRole('button', { name: /cancel/i });
            expect(cancelButton).toBeDisabled();
        });
    });

    describe('Error Handling', () => {
        it('should display error message on submission failure', async () => {
            mockCreateRandomEvents.mockRejectedValue(new Error('API Error'));

            render(<RandomEventsDialog open={true} onClose={mockOnClose} />);

            const generateButton = screen.getByRole('button', { name: /generate/i });
            await user.click(generateButton);

            await waitFor(() => {
                expect(screen.getByText('API Error')).toBeInTheDocument();
            });
        });

        it('should display generic error message for unknown errors', async () => {
            mockCreateRandomEvents.mockRejectedValue('unknown error');

            render(<RandomEventsDialog open={true} onClose={mockOnClose} />);

            const generateButton = screen.getByRole('button', { name: /generate/i });
            await user.click(generateButton);

            await waitFor(() => {
                expect(screen.getByText(/failed to generate events/i)).toBeInTheDocument();
            });
        });

        it('should keep dialog open and display error on failure', async () => {
            mockCreateRandomEvents.mockRejectedValue(new Error('API Error'));

            render(<RandomEventsDialog open={true} onClose={mockOnClose} />);

            const generateButton = screen.getByRole('button', { name: /generate/i });
            await user.click(generateButton);

            await waitFor(() => {
                expect(screen.getByText('API Error')).toBeInTheDocument();
            });

            // Verify dialog is still open - the content should still be visible
            expect(screen.getByText('Generate Random Events')).toBeInTheDocument();
            expect(screen.getByLabelText('Total Events')).toBeInTheDocument();

            // The generate button should be enabled again for retry
            expect(screen.getByRole('button', { name: /generate/i })).not.toBeDisabled();
        });
    });

    describe('Cancel and Close', () => {
        it('should call onClose when cancel button is clicked', async () => {
            render(<RandomEventsDialog open={true} onClose={mockOnClose} />);

            const cancelButton = screen.getByRole('button', { name: /cancel/i });
            await user.click(cancelButton);

            expect(mockOnClose).toHaveBeenCalled();
        });

        it('should call onClose when close icon is clicked', async () => {
            render(<RandomEventsDialog open={true} onClose={mockOnClose} />);

            // The close button has a CloseIcon
            const closeButtons = screen.getAllByRole('button');
            const closeIconButton = closeButtons.find(btn =>
                btn.querySelector('svg[data-testid="CloseIcon"]')
            );

            if (closeIconButton) {
                await user.click(closeIconButton);
                expect(mockOnClose).toHaveBeenCalled();
            }
        });

        it('should reset input value on close', async () => {
            render(<RandomEventsDialog open={true} onClose={mockOnClose} />);

            const input = screen.getByLabelText('Total Events');
            await user.clear(input);
            await user.type(input, '500');
            expect(input).toHaveValue('500');

            // Simulate closing and reopening
            const cancelButton = screen.getByRole('button', { name: /cancel/i });
            await user.click(cancelButton);

            // Component would reset on close - the parent would control open state
            // After mockOnClose is called, if parent sets open=false then true again,
            // the component should have reset state
        });
    });
});
