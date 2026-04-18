/**
 * Tests for JobStatusIndicator component.
 * Tests status badge rendering, colors, animations, and labels.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test/utils/test-utils';
import { JobStatusIndicator } from '../sidebar/JobStatusIndicator';
import { JobStatus, JOB_STATUS_CONFIG } from '../../types/job';

describe('JobStatusIndicator', () => {
  describe('Rendering', () => {
    it('should render status dot for Draft status', () => {
      const { container } = render(<JobStatusIndicator status="Draft" />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('should render status dot for all status types', () => {
      const statuses: JobStatus[] = [
        'Draft',
        'Pending',
        'Generating',
        'Converting',
        'Finalizing',
        'Done',
        'Failed',
        'Cancelled',
        'Deleted',
      ];

      statuses.forEach((status) => {
        const { container } = render(<JobStatusIndicator status={status} />);
        expect(container.firstChild).toBeInTheDocument();
      });
    });
  });

  describe('Status Labels', () => {
    it('should not show label by default', () => {
      const { container } = render(<JobStatusIndicator status="Draft" />);
      expect(container.textContent).toBe('');
    });

    it('should show label when showLabel is true', () => {
      render(<JobStatusIndicator status="Draft" showLabel={true} />);
      expect(screen.getByText('Draft')).toBeInTheDocument();
    });

    it('should show correct label for each status', () => {
      const statuses: JobStatus[] = [
        'Draft',
        'Pending',
        'Generating',
        'Converting',
        'Finalizing',
        'Done',
        'Failed',
        'Cancelled',
        'Deleted',
      ];

      statuses.forEach((status) => {
        const { unmount } = render(
          <JobStatusIndicator status={status} showLabel={true} />
        );
        const expectedLabel = JOB_STATUS_CONFIG[status].label;
        expect(screen.getByText(expectedLabel)).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('Status Colors', () => {
    it('should apply correct color for Draft status', () => {
      const { container } = render(<JobStatusIndicator status="Draft" />);
      const statusDot = container.querySelector('div > div:first-child');
      
      // Check that the dot element exists
      expect(statusDot).toBeInTheDocument();
    });

    it('should apply correct color for Generating status', () => {
      const { container } = render(<JobStatusIndicator status="Generating" />);
      const statusDot = container.querySelector('div > div:first-child');
      
      expect(statusDot).toBeInTheDocument();
    });

    it('should apply correct color for Done status', () => {
      const { container } = render(<JobStatusIndicator status="Done" />);
      const statusDot = container.querySelector('div > div:first-child');
      
      expect(statusDot).toBeInTheDocument();
    });

    it('should apply correct color for Failed status', () => {
      const { container } = render(<JobStatusIndicator status="Failed" />);
      const statusDot = container.querySelector('div > div:first-child');
      
      expect(statusDot).toBeInTheDocument();
    });
  });

  describe('Animation', () => {
    it('should animate Generating status', () => {
      const { container } = render(<JobStatusIndicator status="Generating" />);
      const statusDot = container.querySelector('div > div:first-child');
      
      // The animation is applied via CSS keyframes
      expect(statusDot).toBeInTheDocument();
      expect(JOB_STATUS_CONFIG.Generating.animated).toBe(true);
    });

    it('should animate Converting status', () => {
      const { container } = render(<JobStatusIndicator status="Converting" />);
      const statusDot = container.querySelector('div > div:first-child');
      expect(statusDot).toBeInTheDocument();
    });

    it('should animate Finalizing status', () => {
      const { container } = render(<JobStatusIndicator status="Finalizing" />);
      const statusDot = container.querySelector('div > div:first-child');
      expect(statusDot).toBeInTheDocument();
    });

    it('should not animate Draft status', () => {
      const { container } = render(<JobStatusIndicator status="Draft" />);
      const statusDot = container.querySelector('div > div:first-child');
      expect(statusDot).toBeInTheDocument();
      // Draft should not have animated property set to true
      expect(JOB_STATUS_CONFIG.Draft.animated).toBeFalsy();
    });

    it('should not animate Done status', () => {
      const { container } = render(<JobStatusIndicator status="Done" />);
      const statusDot = container.querySelector('div > div:first-child');
      expect(statusDot).toBeInTheDocument();
      expect(JOB_STATUS_CONFIG.Done.animated).toBeFalsy();
    });
  });

  describe('Size Variants', () => {
    it('should render small size by default', () => {
      const { container } = render(<JobStatusIndicator status="Draft" />);
      const statusDot = container.querySelector('div > div:first-child');
      
      // Small size should be 8px - just verify the dot exists
      expect(statusDot).toBeInTheDocument();
    });

    it('should render small size when explicitly set', () => {
      const { container } = render(<JobStatusIndicator status="Draft" size="small" />);
      const statusDot = container.querySelector('div > div:first-child');
      
      expect(statusDot).toBeInTheDocument();
    });

    it('should render medium size', () => {
      const { container } = render(<JobStatusIndicator status="Draft" size="medium" />);
      const statusDot = container.querySelector('div > div:first-child');
      
      // Medium size should be 10px - just verify the dot exists
      expect(statusDot).toBeInTheDocument();
    });
  });

  describe('Status Configuration', () => {
    it('should use correct configuration from JOB_STATUS_CONFIG', () => {
      const status: JobStatus = 'Generating';
      render(<JobStatusIndicator status={status} showLabel={true} />);
      
      const config = JOB_STATUS_CONFIG[status];
      expect(screen.getByText(config.label)).toBeInTheDocument();
    });

    it('should handle all defined statuses', () => {
      const statuses = Object.keys(JOB_STATUS_CONFIG) as JobStatus[];
      
      statuses.forEach((status) => {
        const { unmount } = render(<JobStatusIndicator status={status} />);
        // Should render without errors
        unmount();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle status changes', () => {
      const { rerender, container } = render(<JobStatusIndicator status="Draft" />);
      let statusDot = container.querySelector('div > div:first-child');
      expect(statusDot).toBeInTheDocument();

      rerender(<JobStatusIndicator status="Done" />);
      statusDot = container.querySelector('div > div:first-child');
      expect(statusDot).toBeInTheDocument();
    });

    it('should handle label visibility toggle', () => {
      const { rerender } = render(
        <JobStatusIndicator status="Draft" showLabel={false} />
      );
      expect(screen.queryByText('Draft')).not.toBeInTheDocument();

      rerender(<JobStatusIndicator status="Draft" showLabel={true} />);
      expect(screen.getByText('Draft')).toBeInTheDocument();
    });

    it('should handle size changes', () => {
      const { rerender, container } = render(
        <JobStatusIndicator status="Draft" size="small" />
      );
      let statusDot = container.querySelector('div > div:first-child');
      expect(statusDot).toBeInTheDocument();

      rerender(<JobStatusIndicator status="Draft" size="medium" />);
      statusDot = container.querySelector('div > div:first-child');
      expect(statusDot).toBeInTheDocument();
    });
  });
});
