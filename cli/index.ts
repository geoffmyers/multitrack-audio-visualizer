#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import { ConfigParser, type CLIExportConfig } from './config.js';
import { CLIAudioEngine } from './adapters/CLIAudioEngine.js';
import { CLIVideoExporter } from './export/CLIVideoExporter.js';
import { Logger } from './utils/Logger.js';
import type { ExportOptions } from '../src/types/audio.types.js';

const program = new Command();

program
  .name('multitrack-audio-visualizer')
  .description('Multi-Track Audio Visualizer - CLI Video Export')
  .version('1.0.0');

program
  .command('export')
  .description('Export visualization video')
  .option('-c, --config <path>', 'Path to JSON config file')
  .option('-a, --audio <files>', 'Comma-separated list of audio file paths')
  .option('-p, --preset <name>', 'Preset name to use')
  .option('-o, --output <path>', 'Output video path', 'output.mp4')
  .option('--layout <mode>', 'Layout mode: overlay, overlay-additive, stacked, spectrum-overlay, spectrum-stacked')
  .option('--amplitude-mode <mode>', 'Amplitude mode: individual, normalized')
  .option('--height <percent>', 'Height percentage (1-100)', parseFloat)
  .option('--smoothing <level>', 'Smoothing level (0-5)', parseInt)
  .option('--window-duration <seconds>', 'Window duration in seconds', parseFloat)
  .option('--fps <number>', 'Frames per second', parseInt)
  .option('--codec <codec>', 'Video codec: h264, h265')
  .option('--quality <crf>', 'Quality CRF value (18-28, lower is better)', parseInt)
  .option('--audio-bitrate <bitrate>', 'Audio bitrate (e.g., 192k)')
  .option('--max-frames <number>', 'Limit total frames (for testing)', parseInt)
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (options) => {
    const logger = new Logger(options.verbose);

    try {
      logger.info('Multi-Track Audio Visualizer - CLI Video Export\n');

      // Load config
      let config: CLIExportConfig;

      if (options.config) {
        // Load from config file
        if (options.verbose) {
          logger.verbose(`Loading config from: ${options.config}`);
        }
        const configParser = new ConfigParser();
        config = await configParser.loadConfigFile(options.config);

        // Apply CLI overrides
        if (options.audio) config.audioFiles = options.audio.split(',').map((f: string) => f.trim());
        if (options.preset) config.preset = options.preset;
        if (options.output) config.output = options.output;
        if (options.verbose !== undefined) config.verbose = options.verbose;

        // Apply visualization overrides
        if (!config.overrides) config.overrides = {};
        if (options.layout) config.overrides.layout = options.layout;
        if (options.amplitudeMode) config.overrides.amplitudeMode = options.amplitudeMode;
        if (options.height) config.overrides.heightPercent = options.height;
        if (options.smoothing !== undefined) config.overrides.smoothingLevel = options.smoothing;
        if (options.windowDuration) config.overrides.windowDuration = options.windowDuration;

        // Apply export overrides
        if (!config.export) config.export = {};
        if (options.fps) config.export.fps = options.fps;
        if (options.codec) config.export.codec = options.codec;
        if (options.quality) config.export.quality = options.quality;
        if (options.audioBitrate) config.export.audioBitrate = options.audioBitrate;

      } else if (options.audio) {
        // Build config from CLI arguments
        config = {
          audioFiles: options.audio.split(',').map((f: string) => f.trim()),
          output: options.output,
          preset: options.preset,
          verbose: options.verbose,
          overrides: {},
          export: {}
        };

        if (options.layout) config.overrides!.layout = options.layout;
        if (options.amplitudeMode) config.overrides!.amplitudeMode = options.amplitudeMode;
        if (options.height) config.overrides!.heightPercent = options.height;
        if (options.smoothing !== undefined) config.overrides!.smoothingLevel = options.smoothing;
        if (options.windowDuration) config.overrides!.windowDuration = options.windowDuration;

        if (options.fps) config.export!.fps = options.fps;
        if (options.codec) config.export!.codec = options.codec;
        if (options.quality) config.export!.quality = options.quality;
        if (options.audioBitrate) config.export!.audioBitrate = options.audioBitrate;

      } else {
        logger.error('Either --config or --audio must be specified');
        process.exit(1);
      }

      // Update logger verbose setting from config
      if (config.verbose !== undefined) {
        logger.setVerbose(config.verbose);
      }

      // Parse and validate config
      const configParser = new ConfigParser();
      const audioFileConfigs = configParser.parseAudioFiles(config.audioFiles);
      await configParser.validateAudioFiles(audioFileConfigs);

      // Build export options
      const exportOptions: ExportOptions = await configParser.buildExportOptions(config);

      // Show configuration
      if (config.preset) {
        logger.info(`Using preset: ${config.preset}`);
      }
      logger.info(`Audio files: ${audioFileConfigs.length} track(s)`);
      logger.info(`Output: ${config.output}\n`);

      // Load audio tracks
      logger.header('Loading audio files:');
      const audioEngine = new CLIAudioEngine(logger);
      const tracks = await audioEngine.loadTracks(audioFileConfigs);

      if (tracks.length === 0) {
        logger.error('No audio tracks loaded');
        process.exit(1);
      }

      logger.info('');

      // Create exporter and export video
      const exporter = new CLIVideoExporter(audioEngine, logger);
      await exporter.export(exportOptions, config.output, config.verbose || false, options.maxFrames);

    } catch (error) {
      if (error instanceof Error) {
        logger.error(error.message);
        if (error.stack) {
          console.error('\nStack trace:');
          console.error(error.stack);
        }
      } else {
        logger.error('Unknown error occurred');
      }
      process.exit(1);
    }
  });

program
  .command('list-presets')
  .description('List all available presets')
  .action(async () => {
    const logger = new Logger(false);

    try {
      const configParser = new ConfigParser();
      const presets = await configParser.loadPresets();

      logger.info(`Available presets (${presets.length}):\n`);

      for (const preset of presets) {
        console.log(`  ${preset.name}`);
        console.log(`    Layout: ${preset.settings.layout}`);
        console.log(`    Amplitude: ${preset.settings.amplitudeMode}`);
        console.log(`    Height: ${preset.settings.heightPercent}%`);
        console.log(`    Smoothing: ${preset.settings.smoothingLevel}`);
        console.log(`    Window Duration: ${preset.settings.windowDuration}s`);
        console.log(`    FPS Cap: ${preset.settings.fpsCap}`);
        console.log('');
      }

    } catch (error) {
      logger.error(error instanceof Error ? error.message : 'Unknown error occurred');
      process.exit(1);
    }
  });

program
  .command('show-preset <name>')
  .description('Show details of a specific preset')
  .action(async (name: string) => {
    const logger = new Logger(false);

    try {
      const configParser = new ConfigParser();
      const preset = await configParser.findPresetByName(name);

      if (!preset) {
        const available = await configParser.listPresetNames();
        logger.error(`Preset "${name}" not found. Available presets:\n  - ${available.join('\n  - ')}`);
        process.exit(1);
      }

      logger.info(`Preset: ${preset.name}\n`);
      console.log('Settings:');
      console.log(`  Layout:          ${preset.settings.layout}`);
      console.log(`  Amplitude Mode:  ${preset.settings.amplitudeMode}`);
      console.log(`  Height:          ${preset.settings.heightPercent}%`);
      console.log(`  Smoothing:       ${preset.settings.smoothingLevel}`);
      console.log(`  Window Duration: ${preset.settings.windowDuration}s`);
      console.log(`  FPS Cap:         ${preset.settings.fpsCap}`);
      console.log('');
      console.log(`Created:  ${new Date(preset.createdAt).toLocaleString()}`);
      console.log(`Updated:  ${new Date(preset.updatedAt).toLocaleString()}`);

    } catch (error) {
      logger.error(error instanceof Error ? error.message : 'Unknown error occurred');
      process.exit(1);
    }
  });

// Add default action to show help if no command is provided
program.action(() => {
  program.help();
});

program.parse();
