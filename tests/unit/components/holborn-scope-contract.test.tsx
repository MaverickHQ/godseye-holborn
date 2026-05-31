import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import SettingsPanel from '@/components/core/SettingsPanel';

describe('Holborn-only scope contract', () => {
  it('shows explicit Holborn-only coverage copy', () => {
    render(<SettingsPanel onClose={() => {}} onExportReport={() => {}} />);

    expect(screen.getByText(/coverage area/i)).toBeInTheDocument();
    expect(screen.getByText(/holborn, london ec1/i)).toBeInTheDocument();
    expect(screen.getByText(/single-location scope/i)).toBeInTheDocument();
  });

  it('does not expose add/switch location controls', () => {
    render(<SettingsPanel onClose={() => {}} onExportReport={() => {}} />);

    expect(screen.queryByText(/\+ add/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add location/i })).not.toBeInTheDocument();
  });
});
