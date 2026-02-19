import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../StatusBadge';

describe('StatusBadge', () => {
  it('renders the status text in uppercase by default', () => {
    render(<StatusBadge status="pending" />);
    expect(screen.getByText('PENDING')).toBeInTheDocument();
  });

  it('renders a custom label when provided', () => {
    render(<StatusBadge status="completed" label="Done" />);
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('applies correct class for pending status', () => {
    const { container } = render(<StatusBadge status="pending" />);
    const badge = container.querySelector('span')!;
    expect(badge.className).toContain('bg-yellow-100');
    expect(badge.className).toContain('text-yellow-800');
  });

  it('applies correct class for processing status', () => {
    const { container } = render(<StatusBadge status="processing" />);
    const badge = container.querySelector('span')!;
    expect(badge.className).toContain('bg-blue-100');
    expect(badge.className).toContain('text-blue-800');
  });

  it('applies correct class for completed status', () => {
    const { container } = render(<StatusBadge status="completed" />);
    const badge = container.querySelector('span')!;
    expect(badge.className).toContain('bg-green-100');
    expect(badge.className).toContain('text-green-800');
  });

  it('applies correct class for failed status', () => {
    const { container } = render(<StatusBadge status="failed" />);
    const badge = container.querySelector('span')!;
    expect(badge.className).toContain('bg-red-100');
    expect(badge.className).toContain('text-red-800');
  });

  it('applies correct class for review_required status', () => {
    const { container } = render(<StatusBadge status="review_required" />);
    const badge = container.querySelector('span')!;
    expect(badge.className).toContain('bg-orange-100');
    expect(badge.className).toContain('text-orange-800');
  });

  it('applies default class for unknown status', () => {
    const { container } = render(<StatusBadge status="some_unknown" />);
    const badge = container.querySelector('span')!;
    expect(badge.className).toContain('bg-gray-100');
    expect(badge.className).toContain('text-gray-800');
  });
});
