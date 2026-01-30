import Tesseract from 'tesseract.js';
import { logger } from '../utils/logger';

const WORKER_COUNT = parseInt(process.env['OCR_WORKERS'] ?? '4', 10);

let scheduler: Tesseract.Scheduler | null = null;
let initPromise: Promise<Tesseract.Scheduler> | null = null;

async function createScheduler(): Promise<Tesseract.Scheduler> {
  const sched = Tesseract.createScheduler();
  for (let i = 0; i < WORKER_COUNT; i++) {
    const worker = await Tesseract.createWorker('eng');
    sched.addWorker(worker);
  }
  logger.info(`OCR pool initialized with ${WORKER_COUNT} workers`);
  return sched;
}

async function getScheduler(): Promise<Tesseract.Scheduler> {
  if (scheduler) return scheduler;
  if (!initPromise) {
    initPromise = createScheduler().then((sched) => {
      scheduler = sched;
      return sched;
    });
  }
  return initPromise;
}

export async function ocrRecognize(
  imageBuffer: Buffer
): Promise<Tesseract.RecognizeResult> {
  const sched = await getScheduler();
  return sched.addJob('recognize', imageBuffer) as Promise<Tesseract.RecognizeResult>;
}

export async function shutdownOcrPool(): Promise<void> {
  if (scheduler) {
    await scheduler.terminate();
    scheduler = null;
    initPromise = null;
    logger.info('OCR pool shut down');
  }
}
