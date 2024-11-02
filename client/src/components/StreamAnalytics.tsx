// components/StreamAnalytics.tsx
import React, { useEffect, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart, ChartData, ChartOptions } from 'chart.js';
import useStreamStats from '../hooks/useStreamStats';

const StreamAnalytics: React.FC = () => {
  const streamData = useStreamStats();

  // Create refs for the charts
  const viewCountChartRef = useRef<Chart<'line'>>(null);
  const trafficChartRef = useRef<Chart<'line'>>(null);
  const bitrateChartRef = useRef<Chart<'line'>>(null);

  // Prepare data for the charts based on `streamData`
  const labels = streamData.map((_, index) => `T-${index}`);
  
  const getLineChartData = (label: string, data: number[], color: string): ChartData<'line'> => ({
    labels,
    datasets: [
      {
        label,
        data,
        borderColor: color,
        backgroundColor: `${color}33`,
        fill: true,
      },
    ],
  });

  const viewCountData = getLineChartData(
    'Viewers Count',
    streamData.map(data => data.viewCount),
    '#36a2eb'
  );

  const trafficData = {
    labels,
    datasets: [
      {
        label: 'Incoming Bits per Sec',
        data: streamData.map(data => data.traffic.inBitsPerSec),
        borderColor: '#4bc0c0',
        backgroundColor: '#4bc0c033',
        fill: true,
      },
      {
        label: 'Outgoing Bits per Sec',
        data: streamData.map(data => data.traffic.outBitsPerSec),
        borderColor: '#ff6384',
        backgroundColor: '#ff638433',
        fill: true,
      },
    ],
  };

  const bitrateData = {
    labels,
    datasets: [
      {
        label: 'Video Bitrate',
        data: streamData.map(data => data.video.bitrate),
        borderColor: '#ff9f40',
        backgroundColor: '#ff9f4033',
        fill: true,
      },
      {
        label: 'Audio Bitrate',
        data: streamData.map(data => data.audio.bitrate),
        borderColor: '#9966ff',
        backgroundColor: '#9966ff33',
        fill: true,
      },
    ],
  };

  // Chart options
  const options: ChartOptions<'line'> = {
    responsive: true,
    scales: {
      x: {
        title: { display: true, text: 'Time' },
      },
      y: {
        title: { display: true, text: 'Value' },
      },
    },
  };

  // Cleanup and update charts on stream data change
  useEffect(() => {
    if (viewCountChartRef.current) {
      viewCountChartRef.current.destroy();
    }
    if (trafficChartRef.current) {
      trafficChartRef.current.destroy();
    }
    if (bitrateChartRef.current) {
      bitrateChartRef.current.destroy();
    }

    viewCountChartRef.current = new Chart(document.getElementById('viewCountChart') as HTMLCanvasElement, {
      type: 'line',
      data: viewCountData,
      options: options,
    });

    trafficChartRef.current = new Chart(document.getElementById('trafficChart') as HTMLCanvasElement, {
      type: 'line',
      data: trafficData,
      options: options,
    });

    bitrateChartRef.current = new Chart(document.getElementById('bitrateChart') as HTMLCanvasElement, {
      type: 'line',
      data: bitrateData,
      options: options,
    });

    return () => {
      if (viewCountChartRef.current) {
        viewCountChartRef.current.destroy();
      }
      if (trafficChartRef.current) {
        trafficChartRef.current.destroy();
      }
      if (bitrateChartRef.current) {
        bitrateChartRef.current.destroy();
      }
    };
  }, [streamData]); // Re-run effect when streamData changes

  return (
    <div>
      <h2>Real-Time Stream Analytics</h2>
      <div style={{ width: '80%', margin: '0 auto' }}>
        <div style={{ marginBottom: '20px' }}>
          <h3>Viewers Count</h3>
          <canvas id="viewCountChart"></canvas>
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <h3>Traffic (Bits per Sec)</h3>
          <canvas id="trafficChart"></canvas>
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <h3>Bitrate (Video & Audio)</h3>
          <canvas id="bitrateChart"></canvas>
        </div>
      </div>
    </div>
  );
};

export default StreamAnalytics;
