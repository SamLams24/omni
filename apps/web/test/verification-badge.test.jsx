import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import VerificationBadge from '@/components/VerificationBadge';

describe('VerificationBadge', () => {
  it('renders the non_verifiee label with an icon, not color alone', () => {
    render(<VerificationBadge status="non_verifiee" />);
    expect(screen.getByText('Non vérifiée')).toBeInTheDocument();
  });

  it('renders the verifiee label', () => {
    render(<VerificationBadge status="verifiee" />);
    expect(screen.getByText('Vérifiée')).toBeInTheDocument();
  });

  it('renders the certifiee label', () => {
    render(<VerificationBadge status="certifiee" />);
    expect(screen.getByText('Certifiée')).toBeInTheDocument();
  });

  it('renders nothing for an unrecognized status rather than guessing', () => {
    const { container } = render(<VerificationBadge status="unknown" />);
    expect(container.firstChild).toBeNull();
  });
});
