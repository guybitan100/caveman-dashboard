/**
 * Tests for SearchBar component.
 * Tests user interactions, debouncing, and controlled input behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '../../test/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { SearchBar } from '../sidebar/SearchBar';

// Mock the useDebounce hook
vi.mock('../../hooks/useJobs.ts', () => ({
  useDebounce: vi.fn((value, _delay) => value),
}));

describe('SearchBar', () => {
  let user: ReturnType<typeof userEvent.setup>;
  const mockOnChange = vi.fn();

  beforeEach(() => {
    user = userEvent.setup();
    mockOnChange.mockClear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Rendering', () => {
    it('should render with default placeholder', () => {
      render(<SearchBar value="" onChange={mockOnChange} />);
      expect(screen.getByPlaceholderText('Search jobs...')).toBeInTheDocument();
    });

    it('should render with custom placeholder', () => {
      render(
        <SearchBar
          value=""
          onChange={mockOnChange}
          placeholder="Custom placeholder"
        />
      );
      expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument();
    });

    it('should render search icon', () => {
      render(<SearchBar value="" onChange={mockOnChange} />);
      const searchIcon = screen.getByLabelText('Search jobs');
      expect(searchIcon).toBeInTheDocument();
    });

    it('should not show clear button when value is empty', () => {
      render(<SearchBar value="" onChange={mockOnChange} />);
      expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
    });

    it('should show clear button when value is not empty', () => {
      render(<SearchBar value="test" onChange={mockOnChange} />);
      expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
    });
  });

  describe('User Interaction', () => {
    it('should update input value when typing', async () => {
      render(<SearchBar value="" onChange={mockOnChange} />);
      const input = screen.getByPlaceholderText('Search jobs...');

      await user.type(input, 'test query');
      expect(input).toHaveValue('test query');
    });

    it('should call onChange after typing (with mocked debounce)', async () => {
      // The debounce is mocked to return immediately, so onChange should be called
      render(<SearchBar value="" onChange={mockOnChange} debounceMs={300} />);
      const input = screen.getByPlaceholderText('Search jobs...');

      await user.type(input, 'test');

      // With mocked debounce (returning value immediately), onChange is called on mount and on value change
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
      });
    });

    it('should clear input when clear button is clicked', async () => {
      render(<SearchBar value="test" onChange={mockOnChange} />);

      const clearButton = screen.getByLabelText('Clear search');
      await user.click(clearButton);

      const input = screen.getByPlaceholderText('Search jobs...');
      expect(input).toHaveValue('');
    });

    it('should call onChange with empty string when cleared', async () => {
      render(<SearchBar value="test" onChange={mockOnChange} />);

      const clearButton = screen.getByLabelText('Clear search');
      await user.click(clearButton);

      expect(mockOnChange).toHaveBeenCalledWith('');
    });

    it('should hide clear button after clearing', async () => {
      render(<SearchBar value="test" onChange={mockOnChange} />);

      const clearButton = screen.getByLabelText('Clear search');
      await user.click(clearButton);

      expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
    });
  });

  describe('External Value Updates', () => {
    it('should sync input value when external value prop changes', () => {
      const { rerender } = render(<SearchBar value="initial" onChange={mockOnChange} />);
      expect(screen.getByDisplayValue('initial')).toBeInTheDocument();

      rerender(<SearchBar value="updated" onChange={mockOnChange} />);
      expect(screen.getByDisplayValue('updated')).toBeInTheDocument();
    });

    it('should show clear button when external value changes to non-empty', () => {
      const { rerender } = render(<SearchBar value="" onChange={mockOnChange} />);
      expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();

      rerender(<SearchBar value="external value" onChange={mockOnChange} />);
      expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
    });

    it('should hide clear button when external value changes to empty', () => {
      const { rerender } = render(<SearchBar value="test" onChange={mockOnChange} />);
      expect(screen.getByLabelText('Clear search')).toBeInTheDocument();

      rerender(<SearchBar value="" onChange={mockOnChange} />);
      expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label for search input', () => {
      render(<SearchBar value="" onChange={mockOnChange} />);
      expect(screen.getByLabelText('Search jobs')).toBeInTheDocument();
    });

    it('should have proper aria-label for clear button', () => {
      render(<SearchBar value="test" onChange={mockOnChange} />);
      expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid typing', async () => {
      render(<SearchBar value="" onChange={mockOnChange} />);
      const input = screen.getByPlaceholderText('Search jobs...');

      await user.type(input, 'abcdefghijklmnop');
      expect(input).toHaveValue('abcdefghijklmnop');
    });

    it('should handle special characters', async () => {
      render(<SearchBar value="" onChange={mockOnChange} />);
      const input = screen.getByPlaceholderText('Search jobs...');

      await user.type(input, '!@#$%^&*()');
      expect(input).toHaveValue('!@#$%^&*()');
    });

    it('should handle spaces', async () => {
      render(<SearchBar value="" onChange={mockOnChange} />);
      const input = screen.getByPlaceholderText('Search jobs...');

      await user.type(input, 'test with spaces');
      expect(input).toHaveValue('test with spaces');
    });

    it('should handle Unicode characters', async () => {
      render(<SearchBar value="" onChange={mockOnChange} />);
      const input = screen.getByPlaceholderText('Search jobs...');

      await user.type(input, '测试 тест');
      expect(input).toHaveValue('测试 тест');
    });
  });
});
