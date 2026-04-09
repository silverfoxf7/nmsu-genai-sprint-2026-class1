import "dotenv/config";
import http from "http";
import express from "express";
import OpenAI from "openai";

const openai = new OpenAI();

/** Logs to your terminal on localhost unless NODE_ENV=production or STRESS_TEST_LOG=0 */
const stressTestDevLog =
  process.env.NODE_ENV !== "production" &&
  process.env.STRESS_TEST_LOG !== "0";

function devLog(...args) {
  if (!stressTestDevLog) return;
  console.log(`[stress-test ${new Date().toISOString()}]`, ...args);
}

async function withOpenAiWaitLogging(label, fn) {
  const started = Date.now();
  const heartbeatMs = 4000;
  const timer = setInterval(() => {
    devLog(
      `${label} … still waiting (${Math.round((Date.now() - started) / 1000)}s elapsed)`
    );
  }, heartbeatMs);
  try {
    return await fn();
  } finally {
    clearInterval(timer);
  }
}

const app = express();
const preferredPort = process.env.PORT ? Number(process.env.PORT) : 3000;
const portLocked = Boolean(process.env.PORT);

app.use(express.json());
app.use(express.static("public"));

const stressTestSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    coreAssumptions: {
      type: "array",
      items: { type: "string" },
      description: "Implicit beliefs the idea depends on",
    },
    majorRisks: {
      type: "array",
      items: { type: "string" },
      description: "Concrete ways the plan could fail",
    },
    fastestValidationTest: {
      type: "string",
      description: "One cheap experiment to test the riskiest assumption soon",
    },
  },
  required: ["coreAssumptions", "majorRisks", "fastestValidationTest"],
};

app.post("/stress-test", async (req, res) => {
  const reqId = Math.random().toString(36).slice(2, 10);
  const idea = req.body?.idea;
  if (!idea || typeof idea !== "string" || !idea.trim()) {
    devLog(`req ${reqId} rejected: empty idea`);
    return res
      .status(400)
      .json({ error: 'Missing or empty "idea" string in JSON body.' });
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    devLog(`req ${reqId} rejected: OPENAI_API_KEY not set`);
    return res.status(503).json({
      error:
        "Missing OPENAI_API_KEY. Add it to your .env file in the project root and restart the server.",
    });
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-5";
  const trimmed = idea.trim();
  const preview =
    trimmed.length > 120 ? `${trimmed.slice(0, 120)}…` : trimmed;

  devLog(`req ${reqId} start`, {
    model,
    ideaChars: trimmed.length,
    preview,
  });

  const prompt = `You are a skeptical but constructive startup advisor. Stress-test this idea.

Startup idea:
${trimmed}

Return JSON only (no markdown) that matches the schema: core assumptions the founder is making, major risks, and the single fastest validation test to run this week. Be specific to this idea, not generic.`;

  try {
    devLog(`req ${reqId} calling OpenAI responses.create…`);

    const t0 = Date.now();
    const response = await withOpenAiWaitLogging(`req ${reqId}`, () =>
      openai.responses.create({
        model,
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: prompt }],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "founder_stress_test",
            strict: true,
            schema: stressTestSchema,
          },
        },
      })
    );
    const apiMs = Date.now() - t0;

    devLog(`req ${reqId} OpenAI returned`, {
      ms: apiMs,
      responseId: response.id ?? "(none)",
      outputChars: response.output_text?.length ?? 0,
      usage: response.usage ?? undefined,
    });

    const raw = response.output_text?.trim();
    if (!raw) {
      devLog(`req ${reqId} error: empty output_text`);
      return res.status(502).json({
        error: "The model returned no text. Try again or check OPENAI_MODEL.",
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
      devLog(`req ${reqId} JSON parsed OK`, {
        assumptions: parsed.coreAssumptions?.length,
        risks: parsed.majorRisks?.length,
      });
    } catch {
      devLog(`req ${reqId} error: JSON.parse failed`, raw.slice(0, 200));
      return res.status(502).json({
        error: "Could not parse model output as JSON.",
        detail: raw.slice(0, 500),
      });
    }

    devLog(`req ${reqId} sending 200 to browser`);
    res.json(parsed);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "OpenAI request failed.";
    devLog(`req ${reqId} OpenAI error:`, message);
    console.error(`[stress-test ${reqId}]`, err);
    return res.status(502).json({ error: message });
  }
});

const maxPortAttempts = 25;
const server = http.createServer(app);
let currentPort = preferredPort;

function tryListen(attempt) {
  server.once("error", (err) => {
    if (err.code !== "EADDRINUSE") {
      throw err;
    }
    if (portLocked || attempt + 1 >= maxPortAttempts) {
      console.error(
        `Port ${currentPort} is already in use (EADDRINUSE).\n` +
          `  Another app—or a previous server—is holding that port.\n` +
          `  Free it:  lsof -nP -iTCP:${currentPort} | grep LISTEN   then   kill <PID>\n` +
          `  Or pick another:  PORT=3001 npm start`
      );
      process.exit(1);
    }
    currentPort += 1;
    tryListen(attempt + 1);
  });

  server.listen(currentPort, () => {
    server.removeAllListeners("error");
    if (currentPort !== preferredPort) {
      console.warn(
        `Port ${preferredPort} was busy; using ${currentPort} instead.`
      );
    }
    console.log(`Founder Stress Tester at http://localhost:${currentPort}`);
    if (stressTestDevLog) {
      console.log(
        "[stress-test] Dev logging on (terminal updates every ~4s while OpenAI is working). Set STRESS_TEST_LOG=0 or NODE_ENV=production to disable."
      );
    }
  });
}

tryListen(0);
