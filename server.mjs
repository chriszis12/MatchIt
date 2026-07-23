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
const apiKey = process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY;

// All available models from your AI Studio list
const GEMINI_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite"
];

// 3-Tier Spiciness System
const prompts = {
  en: {
    chill: {
      system: "You write funny, lighthearted party-game prompts for 'Who is most likely to...'. Reply ONLY with the completion, max 12 words, no lists, no quotes.",
      user: "Give me a chill, funny completion for 'Who is most likely to...'"
    },
    awkward: {
      system: "You write edgy, awkward, and highly embarrassing party-game prompts for friends. Topics: weird internet habits, betraying friends for money, stalking exes, embarrassing secrets, being completely unreliable. NOT sexually explicit, just awkward and spicy. Reply ONLY with the completion, max 15 words, no quotes.",
      user: "Give me an edgy and embarrassing party prompt."
    },
    nsfw: {
      system: "You write wild, inappropriate, unhinged 18+ adult party game prompts. Topics: illegal-ish behavior, severe hangovers, stealing, toxic traits, wild hookups, extreme degeneracy, and dark secrets. NOT just sex—include general unhinged adult behavior. Reply ONLY with ONE prompt, max 15 words, no quotes.",
      user: "Give me a highly inappropriate, wild 18+ party prompt."
    },
    punishment: {
      system: "You generate funny, safe physical dares or embarrassing tasks for a party game. Reply with ONLY ONE dare, max 12 words, no intro, no quotes.",
      user: "Give me a new funny physical dare."
    }
  },
  el: {
    chill: {
      system: `Ολοκληρώνεις την πρόταση "Ποιος είναι πιο πιθανό να..." με κάτι αστείο. Απάντησε ΜΟΝΟ με τη συνέχεια, μέχρι 12 λέξεις, χωρίς εισαγωγικά.`,
      user: "Δώσε μια χαλαρή, αστεία συνέχεια για το «Ποιος είναι πιο πιθανό να...»."
    },
    awkward: {
      system: `Γράφεις αμήχανες, ντροπιαστικές και "κακεντρεχείς" ερωτήσεις για παρέες. Θέματα: κρυφά προφίλ, προδοσία φίλων, παρακολούθηση πρώην, περίεργες συνήθειες. ΟΧΙ σεξουαλικά ακραίες, απλά άβολες. Απάντησε ΜΟΝΟ με μία πρόταση, μέχρι 15 λέξεις, χωρίς εισαγωγικά.`,
      user: "Δώσε μια άβολη και πικάντικη ερώτηση/πρόκληση για την παρέα."
    },
    nsfw: {
      system: `Γράφεις ακραίες, ακατάλληλες (18+) ερωτήσεις για παρέες. Θέματα: ακραία μεθύσια, τοξική συμπεριφορά, μικροκλοπές, άγρια σεξουαλικά σκηνικά, σκοτεινά μυστικά. ΟΧΙ μόνο σεξ, αλλά γενική ακραία ενήλικη συμπεριφορά. Απάντησε ΜΟΝΟ με μία πρόταση, μέχρι 15 λέξεις, χωρίς εισαγωγικά.`,
      user: "Δώσε μια άκρως ακατάλληλη 18+ πρόκληση."
    },
    punishment: {
      system: `Γράφεις αστεία, σύντομα τολμήματα για παρέα. Απάντησε ΜΟΝΟ με ένα τόλμημα, μέχρι 12 λέξεις, χωρίς εισαγωγικά.`,
      user: "Δώσε ένα καινούριο αστείο τόλμημα."
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
      
      let kind = "chill";
      if (body.isPunishment) {
        kind = "punishment";
      } else {
        if (body.spiciness === 2) kind = "awkward";
        if (body.spiciness === 3) kind = "nsfw";
      }

      const prompt = prompts[language][kind];
      const excluded = Array.isArray(body.exclude) ? body.exclude.slice(-30) : [];
      const exclusionInstruction = excluded.length
        ? `\nDo not repeat these:\n- ${excluded.join("\n- ")}`
        : "";

      const requestBody = JSON.stringify({
        systemInstruction: { parts: [{ text: prompt.system }] },
        contents: [{ role: "user", parts: [{ text: prompt.user + exclusionInstruction }] }],
        generationConfig: { maxOutputTokens: 256, temperature: 1.1 }
      });

      let text = null;

      for (const model of GEMINI_MODELS) {
        try {
          const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: requestBody
          });

          if (upstream.ok) {
            const data = await upstream.json();
            text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("").trim();
            if (text) break;
          } else {
            const errDetail = await upstream.text();
            console.warn(`Model ${model} failed [${upstream.status}]: ${errDetail}`);
          }
        } catch (e) {
          console.warn(`Error calling ${model}:`, e.message);
        }
      }

      if (!text) {
        sendJson(response, 200, { text: null, source: "fallback" });
        return;
      }

      sendJson(response, 200, { text, source: "ai" });
    } catch (error) {
      console.error("Internal Server Error:", error);
      sendJson(response, 200, { text: null, source: "fallback" });
    }
    return;
  }
  sendJson(response, 404, { error: "Not found" });
});

server.listen(port, () => console.log(`Match It running at http://localhost:${port}`));
