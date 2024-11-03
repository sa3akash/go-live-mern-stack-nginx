

import express from 'express';
import mongoose from 'mongoose';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';

// Create Express app
const app = express();

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/video_db');

// Define video schema
const videoSchema = new mongoose.Schema({
  name: String,
  hlsUrl: String,
  thumbnails: [String],
  size: Number,
  duration: Number,
  resolution: String,
  codec: String,
});

const Video = mongoose.model('Video', videoSchema);

// Serve static files for HLS and thumbnails
app.use('/hls', express.static(path.join(__dirname, 'public/hls')));
app.use('/thumbnails', express.static(path.join(__dirname, 'public/thumbnails')));

// Body parser middleware for JSON
app.use(express.json());

// Your video processing route
app.post('/streams/record-done', async (req, res) => {
  const { name, path: videoPath } = req.body;
  const hlsPath = path.join(__dirname, 'public/hls', `${name}.m3u8`);
  const thumbnailDir = path.join(__dirname, 'public/thumbnails');

  // Ensure thumbnail directory exists
  if (!fs.existsSync(thumbnailDir)) {
    fs.mkdirSync(thumbnailDir, { recursive: true });
  }

  try {
    // Get video metadata
    ffmpeg.ffprobe(videoPath, async (err, metadata) => {
      if (err) {
        console.error('Error getting video metadata:', err);
        return res.status(500).send('Error processing video');
      }

      const videoSize = metadata.format.size;
      const duration = metadata.format.duration;
      const resolution = `${metadata.streams[0].width}x${metadata.streams[0].height}`;
      const codec = metadata.streams[0].codec_name;

      // Generate thumbnails
      const timestamps = Array.from({ length: 4 }, () => (Math.random() * duration).toFixed(2));
      const thumbnailPaths = [];

      for (const timestamp of timestamps) {
        const thumbnailPath = path.join(thumbnailDir, `${name}_thumbnail_${timestamp}.jpg`);
        thumbnailPaths.push(thumbnailPath);
        await new Promise((resolve, reject) => {
          ffmpeg(videoPath)
            .on('end', resolve)
            .on('error', reject)
            .screenshots({
              timestamps: [timestamp],
              filename: path.basename(thumbnailPath),
              folder: thumbnailDir,
            });
        });
      }

    //   const heightToResolutions = {  
    //     1080: [  
    //       { resolution: '1080p', bitrate: 4000000 },  
    //       { resolution: '720p', bitrate: 2500000 },  
    //       { resolution: '480p', bitrate: 1000000 },  
    //       { resolution: '360p', bitrate: 750000 },  
    //       { resolution: '240p', bitrate: 400000 },  
    //     ],  
    //     720: [  
    //       { resolution: '720p', bitrate: 2500000 },  
    //       { resolution: '480p', bitrate: 1000000 },  
    //       { resolution: '360p', bitrate: 750000 },  
    //       { resolution: '240p', bitrate: 400000 },  
    //     ],  
    //     480: [  
    //       { resolution: '480p', bitrate: 1000000 },  
    //       { resolution: '360p', bitrate: 750000 },  
    //       { resolution: '240p', bitrate: 400000 },  
    //     ],  
    //   };  
      
    //   const height = metadata.streams[0].height;  
    //   const resolutions = heightToResolutions[height] || [];

      // Determine HLS variants based on original resolution
      const resolutions = [];
      if (metadata.streams[0].height === 1080) {
        resolutions.push({ resolution: '1080p', bitrate: 4000000 });
        resolutions.push({ resolution: '720p', bitrate: 2500000 });
        resolutions.push({ resolution: '480p', bitrate: 1000000 });
        resolutions.push({ resolution: '360p', bitrate: 750000 });
        resolutions.push({ resolution: '240p', bitrate: 400000 });
      } else if (metadata.streams[0].height === 720) {
        resolutions.push({ resolution: '720p', bitrate: 2500000 });
        resolutions.push({ resolution: '480p', bitrate: 1000000 });
        resolutions.push({ resolution: '360p', bitrate: 750000 });
        resolutions.push({ resolution: '240p', bitrate: 400000 });
      } else if (metadata.streams[0].height === 480) {
        resolutions.push({ resolution: '480p', bitrate: 1000000 });
        resolutions.push({ resolution: '360p', bitrate: 750000 });
        resolutions.push({ resolution: '240p', bitrate: 400000 });
      }

      // Generate HLS output for each resolution
      const hlsPromises = resolutions.map(({ resolution, bitrate }) => {
        const hlsVariantPath = path.join(__dirname, 'public/hls', `${name}_${resolution}.m3u8`);
        return new Promise((resolve, reject) => {
          ffmpeg(videoPath)
            .outputOptions([
              `-c:a aac`,
              `-b:a 128k`,
              `-c:v libx264`,
              `-b:v ${bitrate}`,
              `-f hls`,
              `-hls_time 5`,
              `-hls_list_size 0`,
              `-hls_segment_filename ${path.join(__dirname, 'public/hls', `${name}_${resolution}_%03d.ts`)}`,
            ])
            .output(hlsVariantPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
        });
      });

      await Promise.all(hlsPromises);

      // Save video metadata to MongoDB
      const video = new Video({
        name,
        hlsUrl: `http://your_server_ip:8888/hls/${name}.m3u8`,
        thumbnails: thumbnailPaths,
        size: videoSize,
        duration: duration,
        resolution,
        codec,
      });

      await video.save();
      console.log(`Processed ${name}: HLS URL and thumbnails saved.`);
      res.sendStatus(200);
    });
  } catch (error) {
    console.error('Error processing video:', error);
    res.status(500).send('Error processing video');
  }
});

// Start Express server
const PORT = process.env.PORT || 8888;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
