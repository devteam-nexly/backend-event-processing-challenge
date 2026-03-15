#!/usr/bin/env tsx
/// <reference types="node" />
/**
 * Event generator script
 *
 * Sends a configurable number of synthetic events to the API.
 * Useful for load testing, concurrency validation, and retry behavior analysis.
 *
 * Usage:
 *   npm run generate-events
 *   npm run generate-events -- --count 10000
 *   npm run generate-events -- --count 5000 --concurrency 50
 *   npm run generate-events -- --count 100 --guaranteed-mix
 *
 * Configuration priority: CLI args > environment variables > defaults
 */

import { randomUUID } from 'crypto';

type ForcedOutcome = "success" | "transient_failure" | "dlq";

interface ScriptOptions {
  count: number;
  concurrency: number;
  guaranteedMix: boolean;
}

function parseArgs(): ScriptOptions {
  const args = process.argv.slice(2);
  let count: number | undefined;
  let concurrency: number | undefined;
  let guaranteedMix = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--count" && args[i + 1] !== undefined) {
      count = Number(args[++i]);
    } else if (args[i] === "--concurrency" && args[i + 1] !== undefined) {
      concurrency = Number(args[++i]);
    } else if (args[i] === "--guaranteed-mix") {
      guaranteedMix = true;
    }
  }

  return {
    count: count ?? Number(process.env.TOTAL_EVENTS ?? 10_000),
    concurrency: concurrency ?? Number(process.env.CONCURRENCY ?? 20),
    guaranteedMix,
  };
}

const {
  count: TOTAL_EVENTS,
  concurrency: CONCURRENCY,
  guaranteedMix: GUARANTEED_MIX,
} = parseArgs();
const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const ENDPOINT = `${API_URL}/events`;

const EVENT_TYPES = [
  'order.created',
  'order.updated',
  'order.cancelled',
  'payment.approved',
  'payment.refused',
  'customer.registered',
  'customer.updated',
] as const;

const TENANT_IDS = ['tenant_a', 'tenant_b', 'tenant_c'] as const;

type EventType = (typeof EVENT_TYPES)[number];
type TenantId = (typeof TENANT_IDS)[number];

interface EventPayload {
  event_id: string;
  tenant_id: TenantId;
  type: EventType;
  payload: Record<string, unknown>;
}

function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)] as T;
}

function buildEvent(forcedOutcome?: ForcedOutcome): EventPayload {
  return {
    event_id: randomUUID(),
    tenant_id: randomItem(TENANT_IDS),
    type: randomItem(EVENT_TYPES),
    payload: {
      ref: randomUUID(),
      value: parseFloat((Math.random() * 1000).toFixed(2)),
      currency: "BRL",
      generatedAt: new Date().toISOString(),
      ...(forcedOutcome ? { test_outcome: forcedOutcome } : {}),
    },
  };
}

function buildGuaranteedMixPlan(total: number): ForcedOutcome[] {
  if (total < 3) {
    return Array.from({ length: total }, () => "success");
  }

  const successCount = Math.max(1, Math.floor(total * 0.6));
  const transientCount = Math.max(1, Math.floor(total * 0.25));
  const dlqCount = Math.max(1, total - successCount - transientCount);

  const plan: ForcedOutcome[] = [
    ...Array.from({ length: successCount }, () => "success" as const),
    ...Array.from(
      { length: transientCount },
      () => "transient_failure" as const,
    ),
    ...Array.from({ length: dlqCount }, () => "dlq" as const),
  ];

  while (plan.length > total) {
    plan.pop();
  }

  while (plan.length < total) {
    plan.push("success");
  }

  for (let i = plan.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [plan[i], plan[j]] = [plan[j], plan[i]];
  }

  return plan;
}

async function sendEvent(event: EventPayload): Promise<{ ok: boolean; status: number }> {
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

async function runBatch(events: EventPayload[]): Promise<{ ok: number; failed: number }> {
  const results = await Promise.all(events.map(sendEvent));
  return results.reduce(
    (acc, r) => {
      if (r.ok) acc.ok++;
      else acc.failed++;
      return acc;
    },
    { ok: 0, failed: 0 },
  );
}

async function main(): Promise<void> {
  console.log(`\nNexly Challenge — Event Generator`);
  console.log(`  Target      : ${ENDPOINT}`);
  console.log(`  Total       : ${TOTAL_EVENTS.toLocaleString()} events`);
  console.log(`  Concurrency : ${CONCURRENCY} simultaneous requests\n`);

  const forcedPlan = GUARANTEED_MIX
    ? buildGuaranteedMixPlan(TOTAL_EVENTS)
    : null;
  if (forcedPlan) {
    const successCount = forcedPlan.filter((item) => item === "success").length;
    const transientCount = forcedPlan.filter(
      (item) => item === "transient_failure",
    ).length;
    const dlqCount = forcedPlan.filter((item) => item === "dlq").length;

    console.log("  Guaranteed mix enabled:");
    console.log(`    success            : ${successCount}`);
    console.log(`    transient_failure  : ${transientCount}`);
    console.log(`    dlq                : ${dlqCount}\n`);
  }

  let totalOk = 0;
  let totalFailed = 0;
  const startTime = Date.now();

  for (let offset = 0; offset < TOTAL_EVENTS; offset += CONCURRENCY) {
    const batchSize = Math.min(CONCURRENCY, TOTAL_EVENTS - offset);
    const batch = forcedPlan
      ? forcedPlan
          .slice(offset, offset + batchSize)
          .map((outcome) => buildEvent(outcome))
      : Array.from({ length: batchSize }, () => buildEvent());
    const { ok, failed } = await runBatch(batch);

    totalOk += ok;
    totalFailed += failed;

    const processed = offset + batchSize;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    process.stdout.write(
      `\r  Progress: ${processed.toLocaleString()} / ${TOTAL_EVENTS.toLocaleString()} | OK: ${totalOk} | Failed: ${totalFailed} | ${elapsed}s`,
    );
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const throughput = (TOTAL_EVENTS / Number(elapsed)).toFixed(0);

  console.log(`\n\n  Done in ${elapsed}s`);
  console.log(`  Throughput : ~${throughput} events/s`);
  console.log(`  Succeeded  : ${totalOk.toLocaleString()}`);
  console.log(`  Failed     : ${totalFailed.toLocaleString()}\n`);
}

void main();
