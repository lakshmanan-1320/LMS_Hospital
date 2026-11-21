import {
  Injectable,
  BadRequestException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { execFile } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

export interface VideoMetadata {
  durationSeconds: number;
  width: number;
  height: number;
  videoCodec: string;
  audioCodec: string | null;
  hasAudio: boolean;
  sampleRate: number | null;
  channels: number | null;
  format: string | null;
  thumbnailKey?: string | null;
}

interface FFprobeOutput {
  streams?: Array<{
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    sample_rate?: string | number;
    channels?: number;
  }>;
  format?: {
    duration?: string;
    format_name?: string;
  };
}

@Injectable()
export class VideoProcessorService {
  private readonly logger = new Logger(VideoProcessorService.name);

  private readonly ffprobePath =
    process.env.FFPROBE_PATH || 'ffprobe';

  private readonly ffmpegPath =
    process.env.FFMPEG_PATH ||
    (process.env.FFPROBE_PATH
      ? process.env.FFPROBE_PATH.replace(/ffprobe(\.exe)?$/i, 'ffmpeg$1')
      : 'ffmpeg');

  async inspectVideo(filePath: string): Promise<VideoMetadata> {
    if (!filePath) {
      throw new BadRequestException('Video file path is missing');
    }

    const output = await this.runFFprobe(filePath);

    let probe: FFprobeOutput;

    try {
      probe = JSON.parse(output) as FFprobeOutput;
    } catch {
      throw new BadRequestException('Unable to read video metadata');
    }

    const streams = probe.streams ?? [];

    const videoStream = streams.find(
      (stream) => stream.codec_type === 'video',
    );

    const audioStream = streams.find(
      (stream) => stream.codec_type === 'audio',
    );

    if (!videoStream) {
      throw new BadRequestException(
        'Uploaded file does not contain a valid video stream',
      );
    }

    const durationSeconds = Number(probe.format?.duration);
    const width = Number(videoStream.width);
    const height = Number(videoStream.height);

    if (
      !Number.isFinite(durationSeconds) ||
      durationSeconds <= 0 ||
      !Number.isInteger(width) ||
      width <= 0 ||
      !Number.isInteger(height) ||
      height <= 0
    ) {
      throw new BadRequestException(
        'Video metadata is invalid or incomplete',
      );
    }

    if (!videoStream.codec_name) {
      throw new BadRequestException(
        'Unable to identify the video codec',
      );
    }

    const hasAudio = Boolean(audioStream && audioStream.codec_name);
    const sampleRate = audioStream?.sample_rate
      ? Number(audioStream.sample_rate)
      : null;
    const channels = audioStream?.channels
      ? Number(audioStream.channels)
      : null;

    if (!hasAudio) {
      this.logger.warn(
        `[VideoProcessor] Video "${filePath}" has NO audio stream (silent video).`,
      );
    }

    const metadata: VideoMetadata = {
      durationSeconds: Math.ceil(durationSeconds),
      width,
      height,
      videoCodec: videoStream.codec_name,
      audioCodec: audioStream?.codec_name ?? null,
      hasAudio,
      sampleRate,
      channels,
      format: probe.format?.format_name ?? null,
    };

    this.logger.log(
      `Video inspected successfully: ${width}x${height}, ${metadata.durationSeconds}s, videoCodec=${metadata.videoCodec}, hasAudio=${hasAudio}, audioCodec=${metadata.audioCodec ?? 'none'}`,
    );

    return metadata;
  }

  /**
   * Generates a high quality thumbnail JPEG from the video at 1.0s (or 0.1s if short).
   */
  async generateThumbnail(videoPath: string, outputPath: string): Promise<string> {
    const outDir = dirname(outputPath);
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      execFile(
        this.ffmpegPath,
        [
          '-ss',
          '00:00:01.000',
          '-i',
          videoPath,
          '-vframes',
          '1',
          '-q:v',
          '2',
          '-y',
          outputPath,
        ],
        { timeout: 30_000, windowsHide: true },
        (error, _stdout, stderr) => {
          if (error) {
            this.logger.warn(
              `Thumbnail extraction at 1s failed, retrying at 0s: ${stderr || error.message}`,
            );
            // Fallback to frame 0
            execFile(
              this.ffmpegPath,
              ['-i', videoPath, '-vframes', '1', '-q:v', '2', '-y', outputPath],
              { timeout: 30_000, windowsHide: true },
              (fbError) => {
                if (fbError) {
                  this.logger.error(`Thumbnail generation failed: ${fbError.message}`);
                  reject(fbError);
                } else {
                  resolve(outputPath);
                }
              },
            );
            return;
          }
          resolve(outputPath);
        },
      );
    });
  }

  /**
   * Generates HLS playlist (master.m3u8) and .ts segments for adaptive/segmented streaming.
   */
  async generateHls(
    videoPath: string,
    outputDir: string,
    hasAudio: boolean,
  ): Promise<string> {
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const playlistPath = join(outputDir, 'master.m3u8');
    const segmentPattern = join(outputDir, 'segment_%03d.ts');

    const args = [
      '-i',
      videoPath,
      '-preset',
      'veryfast',
      '-g',
      '48',
      '-sc_threshold',
      '0',
      '-hls_time',
      '6',
      '-hls_list_size',
      '0',
      '-hls_segment_filename',
      segmentPattern,
      '-c:v',
      'copy',
    ];

    if (hasAudio) {
      args.push('-c:a', 'aac');
    } else {
      args.push('-an');
    }

    args.push('-y', playlistPath);

    return new Promise((resolve, reject) => {
      execFile(
        this.ffmpegPath,
        args,
        { timeout: 180_000, windowsHide: true },
        (error, _stdout, stderr) => {
          if (error) {
            this.logger.warn(
              `HLS copy transcode failed, attempting re-encode: ${stderr || error.message}`,
            );
            // Fallback re-encode if copy fails
            const reencodeArgs = [
              '-i',
              videoPath,
              '-c:v',
              'libx264',
              '-preset',
              'veryfast',
              '-g',
              '48',
              '-sc_threshold',
              '0',
              '-hls_time',
              '6',
              '-hls_list_size',
              '0',
              '-hls_segment_filename',
              segmentPattern,
            ];
            if (hasAudio) {
              reencodeArgs.push('-c:a', 'aac');
            } else {
              reencodeArgs.push('-an');
            }
            reencodeArgs.push('-y', playlistPath);

            execFile(
              this.ffmpegPath,
              reencodeArgs,
              { timeout: 300_000, windowsHide: true },
              (reErr, _res, reStderr) => {
                if (reErr) {
                  this.logger.error(`HLS generation completely failed: ${reStderr || reErr.message}`);
                  reject(reErr);
                } else {
                  resolve(playlistPath);
                }
              },
            );
            return;
          }
          resolve(playlistPath);
        },
      );
    });
  }

  private runFFprobe(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        this.ffprobePath,
        [
          '-v',
          'error',
          '-show_entries',
          'format=duration,format_name:stream=codec_type,codec_name,width,height,sample_rate,channels',
          '-of',
          'json',
          filePath,
        ],
        {
          timeout: 60_000,
          maxBuffer: 5 * 1024 * 1024,
          windowsHide: true,
        },
        (error, stdout, stderr) => {
          if (error) {
            this.logger.error(
              `FFprobe failed: ${stderr || error.message}`,
            );

            if (
              error.message.includes('ENOENT') ||
              (error as NodeJS.ErrnoException).code === 'ENOENT'
            ) {
              reject(
                new ServiceUnavailableException(
                  'FFprobe is not installed or its executable path is not configured',
                ),
              );
              return;
            }

            reject(
              new BadRequestException(
                'Uploaded video could not be validated. Please upload a valid video file.',
              ),
            );
            return;
          }

          resolve(stdout);
        },
      );
    });
  }
}
