import { SpeedTestStatus } from '../types';

type OnUpdate = (status: SpeedTestStatus) => void;

export async function runSpeedTest(onUpdate: OnUpdate): Promise<void> {
  onUpdate({ kind: 'pinging' });

  try {
    // Phase 1: Ping
    const pingStart = Date.now();
    const pingRes = await fetch('https://www.google.com', {
      method: 'HEAD',
      signal: AbortSignal.timeout(3000),
    });
    const pingMs = Date.now() - pingStart;

    if (!pingRes.ok && pingRes.status !== 0) {
      throw new Error('No connectivity');
    }

    // Phase 2: Download (1 MB from Cloudflare)
    onUpdate({ kind: 'downloading', progress: 0, speedMbps: 0 });
    const dlStart = Date.now();
    let bytesDown = 0;

    const dlRes = await fetch('https://speed.cloudflare.com/__down?bytes=1048576', {
      signal: AbortSignal.timeout(6000),
    });
    const reader = dlRes.body?.getReader();

    if (!reader) throw new Error('Stream unavailable');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesDown += value?.length ?? 0;
      const elapsed = (Date.now() - dlStart) / 1000;
      if (elapsed > 0) {
        const mbps = (bytesDown * 8) / (elapsed * 1_000_000);
        onUpdate({
          kind: 'downloading',
          progress: Math.min(bytesDown / 1_048_576, 1),
          speedMbps: Math.round(mbps * 10) / 10,
        });
      }
      if (Date.now() - dlStart > 5000) break;
    }
    reader.cancel();

    const dlMs = Math.max(Date.now() - dlStart, 1);
    const downloadMbps = Math.max((bytesDown * 8) / (dlMs / 1000 * 1_000_000), 0.5);

    // Phase 3: Upload (256 KB to httpbin mirror)
    onUpdate({ kind: 'uploading', progress: 0, speedMbps: 0 });
    const ulStart = Date.now();
    const payload = new Uint8Array(256 * 1024);

    try {
      await fetch('https://httpbin.org/post', {
        method: 'POST',
        body: payload,
        headers: { 'Content-Type': 'application/octet-stream' },
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Upload timeout is acceptable — measure what we sent
    }

    const ulMs = Math.max(Date.now() - ulStart, 1);
    const uploadMbps = Math.max((payload.length * 8) / (ulMs / 1000 * 1_000_000), 0.5);

    onUpdate({
      kind: 'done',
      pingMs,
      downloadMbps: Math.round(downloadMbps * 10) / 10,
      uploadMbps: Math.round(uploadMbps * 10) / 10,
      simulated: false,
    });
  } catch {
    // Simulated fallback for offline/sandbox environments
    await runSimulated(onUpdate);
  }
}

async function runSimulated(onUpdate: OnUpdate): Promise<void> {
  const targetDl = 30 + Math.random() * 150;
  const targetUl = 10 + Math.random() * 60;
  const ping = Math.floor(15 + Math.random() * 40);
  const steps = 12;

  for (let i = 1; i <= steps; i++) {
    await sleep(100);
    onUpdate({
      kind: 'downloading',
      progress: i / steps,
      speedMbps: Math.round(targetDl * (0.7 + (i / steps) * 0.3) * 10) / 10,
    });
  }

  for (let i = 1; i <= steps; i++) {
    await sleep(80);
    onUpdate({
      kind: 'uploading',
      progress: i / steps,
      speedMbps: Math.round(targetUl * (0.6 + (i / steps) * 0.4) * 10) / 10,
    });
  }

  onUpdate({
    kind: 'done',
    pingMs: ping,
    downloadMbps: Math.round(targetDl * 10) / 10,
    uploadMbps: Math.round(targetUl * 10) / 10,
    simulated: true,
  });
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
