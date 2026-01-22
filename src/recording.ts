import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import os from 'os';

const RECORDINGS_DIR = path.join(__dirname, '../recordings');
if (!fs.existsSync(RECORDINGS_DIR)) fs.mkdirSync(RECORDINGS_DIR, { recursive: true });

const activeRecordings: Map<string, ChildProcessWithoutNullStreams> = new Map();
const recordingPaths: Map<string, string> = new Map();

export function getRecordingFile(scenarioName: string): string | undefined {
  return recordingPaths.get(scenarioName);
}

export function startRecording(scenarioName: string): void {
  if (activeRecordings.has(scenarioName)) return;

  const platform = os.platform();
  let inputArgs: string[] = [];
  const outputFile = path.join(RECORDINGS_DIR, `${scenarioName.replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.mp4`);
  recordingPaths.set(scenarioName, outputFile);

  if (platform === 'darwin') {
    // macOS: screen index 1, no audio
    inputArgs = ['-f', 'avfoundation', '-framerate', '30', '-i', '1:none', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', outputFile];
  } else if (platform === 'win32') {
    inputArgs = ['-f', 'gdigrab', '-framerate', '30', '-i', 'desktop', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', outputFile];
  } else if (platform === 'linux') {
    inputArgs = ['-f', 'x11grab', '-framerate', '30', '-i', ':0.0', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', outputFile];
  } else {
    console.error(`[Recording] Unsupported platform: ${platform}`);
    return;
  }

  const recorder = spawn('ffmpeg', inputArgs);
  recorder.stderr.on('data', (data) => {
    const msg = data.toString();
    if (msg.includes('frame=')) {
      console.log(`[Recording] Recording ${scenarioName}...`);
    }
  });

  recorder.on('error', (err) => {
    console.error(`[Recording] FFmpeg error for ${scenarioName}: ${err.message}`);
  });

  recorder.on('close', (code) => {
    console.log(`[Recording] FFmpeg stopped for ${scenarioName} with code ${code}`);
  });

  activeRecordings.set(scenarioName, recorder);
}

export async function stopRecording(scenarioName: string): Promise<void> {
  const process = activeRecordings.get(scenarioName);
  if (process) {
    process.kill('SIGINT'); // Graceful stop
    await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait 3s for file to finalize
    activeRecordings.delete(scenarioName);
    console.log(`[Recording] Stopped recording for '${scenarioName}'`);
  } else {
    console.warn(`[Recording] No recording process found for '${scenarioName}'`);
  }
}