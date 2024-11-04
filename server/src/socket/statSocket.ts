import { Socket } from "socket.io";
import axios from "axios";
import xml2js from "xml2js";
import Redis from "ioredis";

// Define interfaces for the data structure
interface RTMPStatsResponse {
  rtmp: {
    nginx_version: string;
    nginx_rtmp_version: string;
    uptime: string;
    server: {
      application: Application[];
    };
  };
}

interface Application {
  name: string;
  live: LiveStream;
}

interface LiveStream {
  nclients: number;
  stream: Stream[];
}

interface Stream {
  name: string;
  time: number;
  bytes_in: number;
  bytes_out: number;
  client: number;
  meta: Meta;
}

interface Client {
  id: string;
  address: string;
  time: number;
  flashver: string;
  dropped: number;
  avsync: number;
  timestamp: number;
  publishing: string;
  active: string;
}

interface Meta {
  video: VideoMeta;
  audio: AudioMeta;
}

interface VideoMeta {
  width: number;
  height: number;
  frame_rate: number;
  codec: string;
  profile: string;
  compat: number;
  level: number;
}

interface AudioMeta {
  codec: string;
  profile: string;
  channels: number;
  sample_rate: number;
}

const rtmpStatsUrl = "http://localhost:8888/stat"; // RTMP stats URL

export class RTMPStats {
  private socket: Socket;
  private redis: Redis;
  private viewerCounts: Map<string, number> = new Map(); // Track viewers per stream

  constructor(socket: Socket) {
    this.socket = socket;
    this.redis = new Redis({
      host: "localhost", // Update if needed
      port: 6379, // Update if needed
    }); // Initialize Redis client
    this.startFetchingStats();
    this.trackViewers();
  }

  private trackViewers() {
    // Increase view count when a user starts viewing a stream
    this.socket.on("startViewing", (streamName: string) => {
      const currentCount = this.viewerCounts.get(streamName) || 0;
      this.viewerCounts.set(streamName, currentCount + 1);
      console.log(
        `User started viewing ${streamName}. Current view count: ${
          currentCount + 1
        }`
      );
    });

    // Decrease view count when a user stops viewing a stream
    this.socket.on("stopViewing", (streamName: string) => {
      const currentCount = this.viewerCounts.get(streamName) || 1;
      const newCount = Math.max(0, currentCount - 1); // Ensure it doesn’t go negative
      this.viewerCounts.set(streamName, newCount);
      console.log(
        `User stopped viewing ${streamName}. Current view count: ${newCount}`
      );
    });
  }

  private startFetchingStats() {
    console.log("Running RTMP stats fetcher");

    // Use setInterval to emit stats every 5 seconds
    setInterval(async () => {
      try {
        const { data } = await axios.get(rtmpStatsUrl);
        const parsedData = await this.parseXML(data);
        await this.storeStreamMetrics(parsedData);

        // Emit full 30-minute stats data for each stream in each application
        for (const app of parsedData.rtmp.server.application) {
          if (app.name === "live") {
            // Ensure `live.stream` is an array before iterating
            const streams = Array.isArray(app.live.stream)
              ? app.live.stream
              : [app.live.stream];

            for (const stream of streams) {
              // Retrieve and emit the stored data for this stream
              const streamData = await this.getStreamData(stream.name);

              this.socket.emit("streamChartData", streamData);
            }
          }
        }
      } catch (err) {
        console.error("Error fetching RTMP stats:", err);
      }
    }, 5000); // 5000 milliseconds = 5 seconds
  }

  private async parseXML(xml: string): Promise<RTMPStatsResponse> {
    const parser = new xml2js.Parser({ explicitArray: false });
    try {
      const result = await parser.parseStringPromise(xml);
      return this.transformData(result);
    } catch (err) {
      console.error("Error parsing XML:", err);
      throw err;
    }
  }

  private transformData(data: any): RTMPStatsResponse {
    const transformed: RTMPStatsResponse = {
      rtmp: {
        nginx_version: data.rtmp.nginx_version,
        nginx_rtmp_version: data.rtmp.nginx_rtmp_version,
        uptime: data.rtmp.uptime,
        server: {
          application: [],
        },
      },
    };

    const applications = data.rtmp?.server?.application;

    if (!Array.isArray(applications)) {
      transformed.rtmp.server.application.push(
        this.processApplication(applications)
      );
    } else {
      applications.forEach((app: any) => {
        if (app.name === "live") {
          transformed.rtmp.server.application.push(
            this.processApplication(app)
          );
        }
      });
    }

    return transformed;
  }

  private processApplication(app: any): Application {
    const processedApp: Application = {
      name: app.name,
      live: {
        nclients: app.live.nclients,
        stream: [],
      },
    };

    const streams = app.live.stream;

    if (!streams) return processedApp;

    if (!Array.isArray(streams)) {
      processedApp.live.stream.push(this.processStream(streams));
    } else {
      streams.forEach((stream: any) => {
        processedApp.live.stream.push(this.processStream(stream));
      });
    }

    return processedApp;
  }

  private processStream(stream: any): Stream {
    return {
      name: stream.name,
      time: stream.time,
      bytes_in: stream.bytes_in,
      bytes_out: stream.bytes_out,
      client: this.processClients(stream.client),
      meta: stream.meta,
    };
  }

  private processClients(clients: any): number {
    if (!clients) return 0;
    return Array.isArray(clients) ? clients.length : 0;
  }

  private async storeStreamMetrics(parsedData: RTMPStatsResponse) {
    const applications = parsedData.rtmp.server.application;
    for (const app of applications) {
      if (app.name === "live") {
        for (const stream of app.live.stream) {
          const streamKey = `stream:${stream.name}`;
          const timestamp = Math.floor(Date.now() / 60000) * 60000; // Round to the nearest minute

          const fps = parseFloat(`${stream.meta.video.frame_rate}`) || 0;
          const profile = stream.meta.video.profile || "unknown";
          const bytesIn = parseInt(`${stream.bytes_in}`) || 0;
          const bytesOut = parseInt(`${stream.bytes_out}`) || 0;
          const viewCount = this.viewerCounts.get(stream.name) || 0;

          const bitrate =
            bytesIn > 0 && stream.time > 0 ? (bytesIn * 8) / stream.time : 0;
          const status =
            fps === 0 || bitrate < 100
              ? "dropped"
              : profile === "unknown" || bytesIn === 0
              ? "black"
              : "active";

          const newData = {
            time: timestamp,
            fps,
            profile,
            bytes_in: bytesIn,
            bytes_out: bytesOut,
            viewCount,
            bitrate,
            status,
          };

          // Store in Redis Sorted Set
          await this.redis.zadd(streamKey, timestamp, JSON.stringify(newData));

          // Optionally, trim the set to only keep the last 30 minutes of data
          const thirtyMinutesAgo = timestamp - 30 * 60 * 1000;
          await this.redis.zremrangebyscore(
            streamKey,
            "-inf",
            thirtyMinutesAgo
          );
        }
      }
    }
  }

  public async getStreamData(streamName: string): Promise<any[]> {
    const streamKey = `stream:${streamName}`;
    const currentTime = Math.floor(Date.now() / 60000) * 60000; // Current time rounded to the nearest minute
    const thirtyMinutesAgo = currentTime - 30 * 60 * 1000; // 30 minutes ago

    try {
      // Get all data points for the last 30 minutes from the sorted set
      const data = await this.redis.zrangebyscore(
        streamKey,
        thirtyMinutesAgo,
        "+inf"
      );

      // Parse and format data for charting
      const aggregatedData = data.map((entry) => {
        const metrics = JSON.parse(entry);
        return {
          time: new Date(metrics.time).toLocaleTimeString(), // Format timestamp for display
          bytes_in: metrics.bytes_in,
          bytes_out: metrics.bytes_out,
          viewCount: metrics.viewCount,
          fps: metrics.fps,
          bitrate: metrics.bitrate,
          profile: metrics.profile,
          status: metrics.status,
        };
      });

      return aggregatedData;
    } catch (error) {
      console.error("Error fetching stream data:", error);
      return [];
    }
  }
}
