import { NextResponse } from 'next/server';
import { db } from '@/db';
import { persistentMetricsService } from '@/lib/observability/persistent-metrics';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const days = parseInt(searchParams.get('days') || '7');

  try {
    switch (type) {
      case 'system':
        const systemMetrics = await persistentMetricsService.getSystemMetrics(days * 24);
        return NextResponse.json({
          success: true,
          data: systemMetrics,
          message: `System metrics for last ${days} days`,
        });

      case 'features':
        const featureAnalytics = await persistentMetricsService.getFeatureUsageAnalytics(days);
        return NextResponse.json({
          success: true,
          data: featureAnalytics,
          message: `Feature usage analytics for last ${days} days`,
        });

      case 'cleanup':
        const cleanedRows = await persistentMetricsService.cleanupOldData();
        return NextResponse.json({
          success: true,
          data: { cleanedRows },
          message: `Cleaned up ${cleanedRows} old metric records`,
        });

      default:
        return NextResponse.json(
          { error: 'Invalid analytics type. Use "system", "features", or "cleanup"' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Analytics endpoint error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, userId, ...metricData } = body;

    switch (type) {
      case 'user_activity':
        await persistentMetricsService.recordUserActivity(userId || 'anonymous', metricData);
        return NextResponse.json({
          success: true,
          message: 'User activity recorded successfully',
        });

      default:
        return NextResponse.json(
          { error: 'Invalid metric type. Use "user_activity"' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Analytics POST error:', error);
    return NextResponse.json(
      { error: 'Failed to record metric' },
      { status: 500 }
    );
  }
}
