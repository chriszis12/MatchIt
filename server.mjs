import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadEnvFile } from "node:process";

const directory = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(directory, "index.html");
try {
  loadEnvFile(join(directory, ".env"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const port = Number(process.env.PORT || 3000);
// ANTHROPIC_API_KEY is accepted temporarily so the original launch command
// keeps working for anyone who already put their Gemini key there.
const apiKey = process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY;

const prompts = {
  en: {
    question: {
      system: "You write funny, punchy completions for the party-game prompt 'Who is most likely to...'. Reply with ONLY the completion itself (not the prefix), max 12 words, no lists, no quotation marks.",
      user: "Give me a new funny completion for 'Who is most likely to...'"
    },
    punishment: {
      system: "You generate funny, safe physical dares for a party game. Reply with ONLY ONE dare, max 10 words, no lists, no intro, no quotation marks.",
      user: "Give me a new funny, safe physical dare."
    }
  },
  el: {
    question: {
      system: `Ολοκληρώνεις την πρόταση "Ποιος είναι πιο πιθανό να..." με κάτι αστείο, σε φυσικά καθημερινά ελληνικά.
Η πρόταση περιγράφει συνήθεια ή τάση χαρακτήρα. Μετά το "να" χρησιμοποίησε εξακολουθητικό τύπο, π.χ. "παραγγέλνει", "ξεχνάει", "απαντάει", όχι στιγμιαίο.
Απάντησε ΜΟΝΟ με τη συνέχεια της πρότασης, μέχρι 12 λέξεις, χωρίς εισαγωγικά ή λίστα.`,
      user: "Δώσε μια καινούρια, αστεία συνέχεια για το «Ποιος είναι πιο πιθανό να...»."
    },
    punishment: {
      system: `Γράφεις αστεία, σύντομα και ασφαλή τολμήματα για παρέα, σε φυσικά καθημερινά ελληνικά.
Απάντησε ΜΟΝΟ με ένα τόλμημα, μέχρι 10 λέξεις, χωρίς εισαγωγικά ή λίστα.`,
      user: "Δώσε ένα καινούριο, αστείο και ασφαλές τόλμημα."
    }
  }
};

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 10_000) throw new Error("Request too large");
  }
  return JSON.parse(body);
}

const server = createServer(async (request, response) => {
  if (request.method === "GET" && (request.url === "/" || request.url === "/index.html")) {
    const html = await readFile(htmlPath);
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(html);
    return;
  }

  if (request.method === "POST" && request.url === "/api/message") {
    if (!apiKey) {
      sendJson(response, 503, { error: "GEMINI_API_KEY is not configured" });
      return;
    }

    try {
      const body = await readJson(request);
      const language = body.lang === "el" ? "el" : "en";
      const kind = body.isPunishment === true ? "punishment" : "question";
      const prompt = prompts[language][kind];

      const upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: prompt.system }]
          },
          contents: [{
            role: "user",
            parts: [{ text: prompt.user }]
          }],
          generationConfig: {
            maxOutputTokens: 256,
            temperature: 1,
            thinkingConfig: {
              thinkingLevel: "minimal"
            }
          }
        })
      });

      if (!upstream.ok) {
        const detail = await upstream.text();
        console.error(`Gemini API ${upstream.status}: ${detail}`);
        sendJson(response, upstream.status, { error: "AI service request failed" });
        return;
      }

      const data = await upstream.json();
      const text = data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();
      if (!text) throw new Error("Gemini returned no text");
      sendJson(response, 200, { text });
    } catch (error) {
      console.error(error);
      sendJson(response, 400, { error: "Invalid request" });
    }
    return;
  }

  sendJson(response, 404, { error: "Not found" });
});

server.listen(port, () => {
  console.log(`Match It is running at http://localhost:${port}`);
  if (!apiKey) console.warn("Set GEMINI_API_KEY before requesting AI questions.");
});
