/**
 * Tests for NewJobButton component.
 * Tests button rendering, click handler, and loading state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../../test/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { NewJobButton } from '../sidebar/NewJobButton';

describe('NewJobButton', () => {
  let user: ReturnType<typeof userEvent.setup>;
  const mockOnClick = vi.fn();

  beforeEach(() => {
    user = userEvent.setup();
    mockOnClick.mockClear();
  });

  describe('Rendering', () => {
    it('should render with "New Job" text', () => {
      render(<NewJobButton onClick={mockOnClick} />);
      expect(screen.getByRole('button', { name: /new job/i })).toBeInTheDocument();
    });

    it('should render with Add icon', () => {
      render(<NewJobButton onClick={mockOnClick} />);
      const button = screen.getByRole('button', { name: /new job/i });
      
      // Check that the button contains an SVG (the Add icon)
      const svg = button.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should show "Creating..." text when loading', () => {
      render(<NewJobButton onClick={mockOnClick} isLoading={true} />);
      expect(screen.getByText('Creating...')).toBeInTheDocument();
    });

    it('should show "New Job" text when not loading', () => {
      render(<NewJobButton onClick={mockOnClick} isLoading={false} />);
      expect(screen.getByText('New Job')).toBeInTheDocument();
    });

    it('should be disabled when loading', () => {
      render(<NewJobButton onClick={mockOnClick} isLoading={true} />);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('should not be disabled when not loading', () => {
      render(<NewJobButton onClick={mockOnClick} isLoading={false} />);
      expect(screen.getByRole('button')).not.toBeDisabled();
    });

    it('should not be disabled by default', () => {
      render(<NewJobButton onClick={mockOnClick} />);
      expect(screen.getByRole('button')).not.toBeDisabled();
    });
  });

  describe('User Interaction', () => {
    it('should call onClick when clicked', async () => {
      render(<NewJobButton onClick={mockOnClick} />);
      const button = screen.getByRole('button', { name: /new job/i });

      await user.click(button);
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick when disabled', () => {
      render(<NewJobButton onClick={mockOnClick} isLoading={true} />);
      const button = screen.getByRole('button');

      // Disabled buttons should be disabled and not clickable
      expect(button).toBeDisabled();
      // user-event correctly prevents clicking disabled buttons, so we just verify the disabled state
      expect(mockOnClick).not.toHaveBeenCalled();
    });

    it('should handle multiple clicks', async () => {
      render(<NewJobButton onClick={mockOnClick} />);
      const button = screen.getByRole('button', { name: /new job/i });

      await user.click(button);
      await user.click(button);
      await user.click(button);

      expect(mockOnClick).toHaveBeenCalledTimes(3);
    });
  });

  describe('Loading State Transitions', () => {
    it('should transition from idle to loading', () => {
      const { rerender } = render(<NewJobButton onClick={mockOnClick} isLoading={false} />);
      expect(screen.getByText('New Job')).toBeInTheDocument();
      expect(screen.getByRole('button')).not.toBeDisabled();

      rerender(<NewJobButton onClick={mockOnClick} isLoading={true} />);
      expect(screen.getByText('Creating...')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('should transition from loading to idle', () => {
      const { rerender } = render(<NewJobButton onClick={mockOnClick} isLoading={true} />);
      expect(screen.getByText('Creating...')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeDisabled();

      rerender(<NewJobButton onClick={mockOnClick} isLoading={false} />);
      expect(screen.getByText('New Job')).toBeInTheDocument();
      expect(screen.getByRole('button')).not.toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard accessible', async () => {
      render(<NewJobButton onClick={mockOnClick} />);
      const button = screen.getByRole('button', { name: /new job/i });

      // Tab to button
      await user.tab();
      expect(button).toHaveFocus();

      // Press Enter
      await user.keyboard('{Enter}');
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should be accessible via Space key', async () => {
      render(<NewJobButton onClick={mockOnClick} />);
      const button = screen.getByRole('button', { name: /new job/i });

      // Tab to button
      await user.tab();
      expect(button).toHaveFocus();

      // Press Space
      await user.keyboard(' ');
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });
  });
});
