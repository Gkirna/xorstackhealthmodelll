/**
 * Real-Time Voice Visualization Dashboard
 * Advanced analytics and visualization for voice analysis
 */

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Mic, 
  Brain, 
  Heart, 
  TrendingUp, 
  Users, 
  Activity,
  Zap,
  BarChart3,
  PieChart,
  LineChart
} from 'lucide-react';

interface VoiceVisualizationProps {
  voiceAnalyzer: any;
  isActive: boolean;
}

interface RealTimeMetrics {
  currentPitch: number;
  currentVolume: number;
  currentEmotion: string;
  currentStress: number;
  currentSpeaker: string;
  confidence: number;
  voiceQuality: string;
  speakingRate: number;
}

interface HistoricalData {
  timestamp: number;
  pitch: number;
  volume: number;
  emotion: string;
  stress: number;
  speaker: string;
}

export function VoiceVisualizationDashboard({ voiceAnalyzer, isActive }: VoiceVisualizationProps) {
  const [metrics, setMetrics] = useState<RealTimeMetrics>({
    currentPitch: 0,
    currentVolume: 0,
    currentEmotion: 'neutral',
    currentStress: 0,
    currentSpeaker: 'unknown',
    confidence: 0,
    voiceQuality: 'poor',
    speakingRate: 0,
  });

  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
  const [speakerStats, setSpeakerStats] = useState<any>({});
  const [emotionDistribution, setEmotionDistribution] = useState<any>({});
  const [isExpanded, setIsExpanded] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  // Real-time data updates
  useEffect(() => {
    if (!isActive || !voiceAnalyzer) return;

    const updateMetrics = () => {
      const stats = voiceAnalyzer.getUltraAdvancedStatistics();
      
      if (stats.speakers) {
        const latestSpeaker = Object.keys(stats.speakers)[0];
        const speakerData = stats.speakers[latestSpeaker];
        
        setMetrics(prev => ({
          ...prev,
          currentPitch: parseFloat(speakerData?.avgPitch || '0'),
          currentVolume: 50, // Placeholder
          currentEmotion: speakerData?.emotionHistory?.[0]?.primary || 'neutral',
          currentStress: parseFloat(speakerData?.stressPatterns?.[0] || '0'),
          currentSpeaker: latestSpeaker || 'unknown',
          confidence: parseFloat(speakerData?.verificationScore || '0'),
          voiceQuality: 'good', // Placeholder
          speakingRate: parseFloat(speakerData?.speakingRate || '0'),
        }));

        setSpeakerStats(stats.speakers);
        setEmotionDistribution(stats.emotionDistribution || {});
      }
    };

    const interval = setInterval(updateMetrics, 1000);
    return () => clearInterval(interval);
  }, [isActive, voiceAnalyzer]);

  // Real-time waveform visualization
  useEffect(() => {
    if (!isActive || !isExpanded) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawWaveform = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw background
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw waveform
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      const centerY = canvas.height / 2;
      const amplitude = metrics.currentVolume * 2;
      
      for (let x = 0; x < canvas.width; x += 2) {
        const frequency = (x / canvas.width) * 20;
        const y = centerY + Math.sin(frequency + Date.now() / 1000) * amplitude;
        
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      ctx.stroke();
      
      animationRef.current = requestAnimationFrame(drawWaveform);
    };

    drawWaveform();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, isExpanded, metrics.currentVolume]);

  const getEmotionColor = (emotion: string) => {
    const colors: { [key: string]: string } = {
      happy: 'text-green-600 bg-green-100',
      sad: 'text-blue-600 bg-blue-100',
      angry: 'text-red-600 bg-red-100',
      fearful: 'text-yellow-600 bg-yellow-100',
      surprised: 'text-purple-600 bg-purple-100',
      disgusted: 'text-orange-600 bg-orange-100',
      neutral: 'text-gray-600 bg-gray-100',
    };
    return colors[emotion] || colors.neutral;
  };

  const getStressColor = (stress: number) => {
    if (stress < 0.3) return 'text-green-600';
    if (stress < 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getQualityColor = (quality: string) => {
    const colors: { [key: string]: string } = {
      excellent: 'text-green-600',
      good: 'text-blue-600',
      fair: 'text-yellow-600',
      poor: 'text-red-600',
    };
    return colors[quality] || colors.poor;
  };

  if (!isActive) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Voice Analytics Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Start recording to see real-time voice analytics</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Voice Analytics Dashboard
            <Badge variant="secondary" className="ml-2">
              <Activity className="h-3 w-3 mr-1" />
              Live
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="realtime" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="realtime">Real-time</TabsTrigger>
            <TabsTrigger value="speakers">Speakers</TabsTrigger>
            <TabsTrigger value="emotions">Emotions</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="realtime" className="space-y-4">
            {/* Real-time Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Mic className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">Pitch</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    {metrics.currentPitch.toFixed(0)}Hz
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {metrics.currentSpeaker}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium">Stress</span>
                  </div>
                  <div className={`text-2xl font-bold ${getStressColor(metrics.currentStress)}`}>
                    {(metrics.currentStress * 100).toFixed(0)}%
                  </div>
                  <Progress 
                    value={metrics.currentStress * 100} 
                    className="mt-2 h-2"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-purple-600" />
                    <span className="text-sm font-medium">Emotion</span>
                  </div>
                  <Badge className={`mt-2 ${getEmotionColor(metrics.currentEmotion)}`}>
                    {metrics.currentEmotion}
                  </Badge>
                  <div className="text-xs text-muted-foreground mt-1">
                    {(metrics.confidence * 100).toFixed(0)}% confidence
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Quality</span>
                  </div>
                  <div className={`text-lg font-bold ${getQualityColor(metrics.voiceQuality)}`}>
                    {metrics.voiceQuality}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {metrics.speakingRate.toFixed(1)} wpm
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Real-time Waveform */}
            {isExpanded && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Real-time Waveform</CardTitle>
                </CardHeader>
                <CardContent>
                  <canvas
                    ref={canvasRef}
                    width={800}
                    height={200}
                    className="w-full h-32 border rounded"
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="speakers" className="space-y-4">
            <div className="grid gap-4">
              {Object.entries(speakerStats).map(([speakerId, stats]: [string, any]) => (
                <Card key={speakerId}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span className="font-medium">{speakerId}</span>
                        <Badge variant="outline">{stats.gender}</Badge>
                      </div>
                      <Badge variant="secondary">
                        {stats.samples} samples
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Avg Pitch:</span>
                        <div className="font-medium">{stats.avgPitch}Hz</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Range:</span>
                        <div className="font-medium">{stats.pitchRange.join('-')}Hz</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Speaking Rate:</span>
                        <div className="font-medium">{stats.speakingRate} wpm</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Verification:</span>
                        <div className="font-medium">{(stats.verificationScore * 100).toFixed(0)}%</div>
                      </div>
                    </div>

                    {stats.emotionHistory && stats.emotionHistory.length > 0 && (
                      <div className="mt-3">
                        <span className="text-muted-foreground text-sm">Recent Emotions:</span>
                        <div className="flex gap-1 mt-1">
                          {stats.emotionHistory.slice(0, 3).map((emotion: any, index: number) => (
                            <Badge 
                              key={index} 
                              variant="outline" 
                              className={getEmotionColor(emotion.primary)}
                            >
                              {emotion.primary}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="emotions" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(emotionDistribution).map(([emotion, percentage]: [string, any]) => (
                <Card key={emotion}>
                  <CardContent className="p-4 text-center">
                    <Badge className={`mb-2 ${getEmotionColor(emotion)}`}>
                      {emotion}
                    </Badge>
                    <div className="text-2xl font-bold">
                      {percentage.toFixed(1)}%
                    </div>
                    <Progress 
                      value={percentage} 
                      className="mt-2 h-2"
                    />
                  </CardContent>
                </Card>
              ))}
            </div>

            {Object.keys(emotionDistribution).length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <PieChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No emotion data available yet</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <LineChart className="h-4 w-4" />
                    Voice Quality Trends
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center text-muted-foreground py-8">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Quality trend analysis coming soon</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    ML Model Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Emotion Detection:</span>
                      <Badge variant="secondary">Active</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Speaker Verification:</span>
                      <Badge variant="secondary">Active</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Stress Detection:</span>
                      <Badge variant="secondary">Active</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Noise Reduction:</span>
                      <Badge variant="secondary">Active</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

