import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEffect, useState } from 'react';

// A simple component that fetches data (simulating DashboardStats)
const MockDashboardStats = () => {
  const [stats, setStats] = useState<any[]>([]);

  useEffect(() => {
    fetch('http://localhost:54321/rest/v1/rpc/get_dashboard_stats')
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch(() => setStats([]));
  }, []);

  if (stats.length === 0) return <div>Loading...</div>;

  return (
    <div>
      <div data-testid="total-bags">{stats[0]!.total_bags}</div>
      <div data-testid="revenue">{stats[0]!.revenue}</div>
    </div>
  );
};

describe('DashboardStats (Mocked)', () => {
  beforeEach(() => {
    // Mock fetch to return dashboard stats
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([{ total_bags: 1250, revenue: 50000 }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('renders stats from MSW mock', async () => {
    render(<MockDashboardStats />);

    // Should show loading initially
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Should eventually show the mocked data
    await waitFor(() => {
      expect(screen.getByTestId('total-bags')).toHaveTextContent('1250');
      expect(screen.getByTestId('revenue')).toHaveTextContent('50000');
    });

    vi.restoreAllMocks();
  });
});
