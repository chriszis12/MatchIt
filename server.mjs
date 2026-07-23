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
    adult: {
      system: "You write wild, spicy, direct, and provocative 18+ adult party game prompts for friends. Topics include wild desires, sex positions, office hookups, lap dances, checking partner's phones, oral sex talent, or secret crushes/fantasies in the room. Reply with ONLY ONE question or prompt, max 15 words, no quotation marks, no lists.",
      user: "Give me a spicy, uninhibited 18+ party prompt."
    },
    punishment: {
      system: "You generate funny, safe physical dares or embarrassing tasks for a party game. Reply with ONLY ONE dare, max 10 words, no lists, no intro, no quotation marks.",
      user: "Give me a new funny physical dare."
    }
  },
  el: {
    question: {
      system: `Ολοκληρώνεις την πρόταση "Ποιος είναι πιο πιθανό να..." με κάτι αστείο, σε φυσικά καθημερινά ελληνικά.
Η πρόταση περιγράφει συνήθεια ή τάση χαρακτήρα. Μετά το "να" χρησιμοποίησε εξακολουθητικό τύπο, π.χ. "παραγγέλνει", "ξεχνάει", "απαντάει", όχι στιγμιαίο.
Απάντησε ΜΟΝΟ με τη συνέχεια της πρότασης, μέχρι 12 λέξεις, χωρίς εισαγωγικά ή λίστα.`,
      user: "Δώσε μια καινούρια, αστεία συνέχεια για το «Ποιος είναι πιο πιθανό να...»."
    },
    adult: {
      system: `Γράφεις τολμηρές, πονηρές, πικάντικες και άκρως αποκαλυπτικές ερωτήσεις/προκλήσεις 18+ για παιχνίδι ενηλίκων σε παρέες.
Θέματα: σεξουαλικές φαντασιώσεις, ερωτικά μυστικά, lap dance, στοματικό σεξ, απιστία, παράξενα μέρη για σεξ (π.χ. αεροπλάνο, γραφείο), ερωτικά μηνύματα στην παρέα.
Στυλ: «Δώσε τον αναπτήρα/σπίρτο σε αυτόν/ή που...» ή «Ποιος/α πιστεύεις ότι...» ή «Ποιο άτομο...».
Απάντησε ΜΟΝΟ με μία πρόταση, μέχρι 15 λέξεις, σε φυσικά ελληνικά, χωρίς εισαγωγικά ή λίστα.`,
      user: "Δώσε μια νέα, τολμηρή πρόκληση 18+ για την παρέα."
    },
    punishment: {
      system: `Γράφεις αστεία, σύντομα και ελαφρώς ντροπιαστικά τολμήματα/ποινές για παρέα, σε φυσικά καθημερινά ελληνικά.
Απάντησε ΜΟΝΟ με ένα τόλμημα, μέχρι 10 λέξεις, χωρίς εισαγωγικά ή λίστα.`,
      user: "Δώσε ένα καινούριο αστείο τόλμημα."
    }
  }
};

const fallbackLines = {
  en: {
    question: [
      "forget why they walked into a room.",
      "reply to a message three business days later.",
      "order food and immediately regret their choice.",
      "laugh at the worst possible moment.",
      "start a group chat and then mute it.",
      "lose their phone while holding it.",
      "become famous for something completely accidental.",
      "cancel plans and celebrate when everyone agrees.",
      "bring snacks but eat them before arriving.",
      "turn a five-minute story into a podcast."
    ],
    adult: [
      "Pass the match to whoever would have sex on an office desk at work!",
      "Who here would secretly check their partner's phone for cheating?",
      "Pass the match to whoever would join the mile high club on an airplane!",
      "Who in this room would you want to give you a lap dance?",
      "Who in this room has the biggest talent in oral sex?",
      "Pass the match to the person who would write a bold romantic text to someone in the room!",
      "Who is most likely to stop having sex completely after getting married?",
      "Who in this room has done the wilder thing in bed?"
    ],
    punishment: [
      "Do your best robot dance for ten seconds.",
      "Speak like a movie villain until your next turn.",
      "Pretend the floor is lava for fifteen seconds.",
      "Sing your next sentence like an opera star.",
      "Do 10 jumping jacks while declaring you are a fake friend!"
    ]
  },
  el: {
    question: [
      "ξεχνάει γιατί μπήκε σε ένα δωμάτιο.",
      "απαντάει σε μήνυμα μετά από τρεις εργάσιμες.",
      "παραγγέλνει φαγητό και αμέσως ζηλεύει των άλλων.",
      "γελάει την πιο ακατάλληλη στιγμή.",
      "χάνει το κινητό ενώ το κρατάει.",
      "ακυρώνει σχέδια και μετά το γιορτάζει."
    ],
    adult: [
      "Δώσε τον αναπτήρα σε αυτόν/ή που πιστεύεις ότι θα έκανε σεξ πάνω σε ένα γραφείο σε εταιρικό χώρο!",
      "Ποιος/α πιστεύεις ότι θα έψαχνε το κινητό του συντρόφου του για να δει αν τον/την απατάει;",
      "Δώσε τον αναπτήρα σε αυτόν/ή που πιστεύεις ότι θα έκανε σεξ σε αεροπλάνο!",
      "Ποιο άτομο του αντίθετου φύλου θα ήθελες να σου χορέψει lap dance;",
      "Ποιο άτομο έχει το μεγαλύτερο ταλέντο στο στοματικό σεξ;",
      "Δώσε τον αναπτήρα σε αυτόν/ή που πιστεύεις ότι θα έγραφε τολμηρό ερωτικό γράμμα σε κάποιον/α από την παρέα!",
      "Ποιος/α πιστεύεις πως θα κάνει μια φορά την εβδομάδα έως καθόλου σεξ μετά τον γάμο και τα παιδιά;",
      "Ποιο άτομο από την παρέα έχει κάνει το πιο παράξενο πράγμα στο κρεβάτι;"
    ],
    punishment: [
      "Χόρεψε σαν ρομπότ για δέκα δευτερόλεπτα.",
      "Μίλα σαν κακός ταινίας μέχρι τον επόμενο γύρο.",
      "Κάνε 10 αναπηδήσεις φωνάζοντας ότι είσαι δίπουλος φίλος!",
      "Τραγούδησε την επόμενη πρότασή σου σαν όπερα."
    ]
  }
};

const fallbackPositions = new Map();

function normalizeLine(text) {
  return text
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function nextFallback(language, kind, excluded = []) {
  const key = `${language}:${kind}`;
  const lines = fallbackLines[language][kind];
  const excludedKeys = new Set(excluded.map(normalizeLine));
  let position = fallbackPositions.get(key) ?? Math.floor(Math.random() * lines.length);

  for (let offset = 0; offset < lines.length; offset++) {
    const candidate = lines[(position + offset) % lines.length];
    if (!excludedKeys.has(normalizeLine(candidate))) {
      fallbackPositions.set(key, position + offset + 1);
      return candidate;
    }
  }

  fallbackPositions.set(key, position + 1);
  return lines[position % lines.length];
}

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
      const isAdult = body.isAdult === true;
      const isPunishment = body.isPunishment === true;

      let kind = "question";
      if (isPunishment) {
        kind = "punishment";
      } else if (isAdult) {
        kind = "adult";
      }

      const prompt = prompts[language][kind];
      const excluded = Array.isArray(body.exclude)
        ? body.exclude.filter(item => typeof item === "string").slice(-30)
        : [];
      const exclusionInstruction = excluded.length
        ? `\nDo not repeat or closely paraphrase any of these previous responses:\n- ${excluded.join("\n- ")}`
        : "";

      const requestBody = JSON.stringify({
        systemInstruction: {
          parts: [{ text: prompt.system }]
        },
        contents: [{
          role: "user",
          parts: [{ text: prompt.user + exclusionInstruction }]
        }],
        generationConfig: {
          maxOutputTokens: 256,
          temperature: 1,
          thinkingConfig: {
            thinkingLevel: "minimal"
          }
        }
      });

      let upstream;
      for (let attempt = 0; attempt < 3; attempt++) {
        upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: requestBody
        });

        if (upstream.status !== 429) break;
        if (attempt < 2) {
          await upstream.body?.cancel();
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }

      if (!upstream.ok) {
        const detail = await upstream.text();
        console.error(`Gemini API ${upstream.status}: ${detail}`);

        if (upstream.status === 429 || upstream.status >= 500) {
          sendJson(response, 200, {
            text: nextFallback(language, kind, excluded),
            source: "fallback"
          });
          return;
        }

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
      sendJson(response, 500, { error: "Unable to generate a message" });
    }
    return;
  }

  sendJson(response, 404, { error: "Not found" });
});

server.listen(port, () => {
  console.log(`Match It is running at http://localhost:${port}`);
  if (!apiKey) console.warn("Set GEMINI_API_KEY before requesting AI questions.");
});
