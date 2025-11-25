/**
 * Production Health Monitor for Transcription System
 * Real-time system status and quality metrics
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle, Activity, Zap } from 'lucide-react';

interface HealthMetrics {
  processed: number;
  successful: number;
  failed: number;
  successRate: string;
  qualityMetrics: {
    avgConfidence: string;
    avgChunkSize: string;
    avgProcessingTime: string;
  };
  circuitBreaker: {
    state: 'closed' | 'open' | 'half-open';
    failures: number;
    threshold: number;
  };
  timeSinceLastSuccess: string;
}

interface Props {
  metrics?: HealthMetrics;
  isActive: boolean;
  mode?: 'direct' | 'playback';
}

export function TranscriptionHealthMonitor({ metrics, isActive, mode = 'direct' }: Props) {
  if (!metrics) return null;

  const successRateNum = parseFloat(metrics.successRate);
  const isHealthy = successRateNum >= 95 && metrics.circuitBreaker.state === 'closed';
  const isDegraded = successRateNum >= 80 && successRateNum < 95;
  const isCritical = successRateNum < 80 || metrics.circuitBreaker.state === 'open';

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Transcription System Health
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Real-time performance metrics
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isHealthy && (
              <Badge variant="default" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                <CheckCircle className="h-3 w-3 mr-1" />
                Healthy
              </Badge>
            )}
            {isDegraded && (
              <Badge variant="default" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20">
                <AlertCircle className="h-3 w-3 mr-1" />
                Degraded
              </Badge>
            )}
            {isCritical && (
              <Badge variant="destructive" className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">
                <AlertCircle className="h-3 w-3 mr-1" />
                Critical
              </Badge>
            )}
            {mode === 'playback' && (
              <Badge variant="outline" className="text-xs">
                Playback Mode
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Success Rate */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Success Rate</span>
            <span className="font-medium">{metrics.successRate}</span>
          </div>
          <Progress 
            value={successRateNum} 
            className="h-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{metrics.successful} succeeded</span>
            <span>{metrics.failed} failed</span>
          </div>
        </div>

        {/* Circuit Breaker Status */}
        {metrics.circuitBreaker.state !== 'closed' && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertCircle className="h-4 w-4" />
              Circuit Breaker: {metrics.circuitBreaker.state.toUpperCase()}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.circuitBreaker.failures} failures detected. 
              {metrics.circuitBreaker.state === 'open' 
                ? ' System is recovering. Retrying soon...' 
                : ' Testing recovery...'}
            </p>
          </div>
        )}

        {/* Quality Metrics Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Confidence</div>
            <div className="text-sm font-medium">{metrics.qualityMetrics.avgConfidence}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Chunk Size</div>
            <div className="text-sm font-medium">{metrics.qualityMetrics.avgChunkSize}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Speed
            </div>
            <div className="text-sm font-medium">{metrics.qualityMetrics.avgProcessingTime}</div>
          </div>
        </div>

        {/* Status Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
          <span>
            {isActive ? (
              <span className="flex items-center gap-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                Active
              </span>
            ) : (
              'Inactive'
            )}
          </span>
          <span>Last success: {metrics.timeSinceLastSuccess} ago</span>
        </div>
      </CardContent>
    </Card>
  );
}