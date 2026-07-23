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

// All available models from AI Studio
const GEMINI_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite"
];

const prompts = {
  en: {
    chill: {
      system: "You write funny, lighthearted party-game prompts for 'Who is most likely to...'. Every reply must explore a genuinely different everyday-life topic from the last one - never fall back on the same handful of stock jokes. Reply ONLY with the completion, max 12 words, no lists, no quotes.",
      user: "Give me a chill, funny completion for 'Who is most likely to...'"
    },
    awkward: {
      system: "You write edgy, awkward, and highly embarrassing party-game prompts for friends. NOT sexually explicit, just awkward and spicy. Cover a WIDE range of angles - money and greed, social media cringe, friendship betrayal, family embarrassment, workplace awkwardness, weird personal habits, competitiveness, lying, laziness, vanity - not just exes or stalking. Do not lean on 'stalking an ex's social media' or 'checking a partner's phone' more than rarely; treat those as just two options among many, not the default. Reply ONLY with the completion, max 15 words, no quotes.",
      user: "Give me an edgy and embarrassing party prompt."
    },
    nsfw: {
      system: "You write wild, inappropriate, unhinged adult party game prompts. NOT always explicit sex - include dating drama, intense flirting, wild adult life, jealousy, breakups, workplace flirting, awkward hookups, texting mishaps, secret desires. Do not lean on 'texting an ex' or 'stalking exes/socials' more than rarely; those are just two options among many possible angles, not the default topic. Reply ONLY with ONE prompt, max 15 words, no quotes.",
      user: "Give me a highly inappropriate, wild 18+ party prompt."
    },
    punishment: {
      system: "You generate funny, actionable indoor party punishments and embarrassing dares. Vary the mechanism widely - phone-based dares, voice/singing dares, physical silly dares, roleplay dares, confession dares - don't repeat the same mechanism twice in a row. Reply with ONLY ONE punishment, max 12 words, no intro, no quotes.",
      user: "Give me a new funny indoor party punishment."
    }
  },
  el: {
    chill: {
      system: `Ολοκληρώνεις την πρόταση "Ποιος είναι πιο πιθανό να..." με κάτι αστείο. Κάθε απάντηση πρέπει να εξερευνά ένα πραγματικά διαφορετικό θέμα καθημερινότητας από την προηγούμενη - μην επαναλαμβάνεις τα ίδια λίγα αστεία. Απάντησε ΜΟΝΟ με τη συνέχεια, μέχρι 12 λέξεις, χωρίς εισαγωγικά.`,
      user: "Δώσε μια χαλαρή, αστεία συνέχεια για το «Ποιος είναι πιο πιθανό να...»."
    },
    awkward: {
      system: `Γράφεις αμήχανες, ντροπιαστικές και "κακεντρεχείς" ερωτήσεις για παρέες. ΟΧΙ σεξουαλικά ακραίες, απλά άβολες. Κάλυψε ΕΥΡΥ φάσμα θεμάτων - χρήμα και απληστία, ντροπή στα social media, προδοσία φιλίας, οικογενειακή αμηχανία, αμηχανία στη δουλειά, περίεργες συνήθειες, ανταγωνιστικότητα, ψέματα, τεμπελιά, ματαιοδοξία - όχι μόνο πρώην ή stalking. Μην στηρίζεσαι σε "παρακολούθηση πρώην στα social media" ή "έλεγχος κινητού συντρόφου" παρά μόνο σπάνια· είναι απλώς δύο επιλογές ανάμεσα σε πολλές, όχι το προεπιλεγμένο θέμα. Απάντησε ΜΟΝΟ με μία πρόταση, μέχρι 15 λέξεις, χωρίς εισαγωγικά.`,
      user: "Δώσε μια άβολη και πικάντικη ερώτηση/πρόκληση για την παρέα."
    },
    nsfw: {
      system: `Γράφεις ακραίες, ακατάλληλες (18+) ερωτήσεις για παρέες. ΟΧΙ πάντα μόνο σεξ, αλλά δράματα σχέσεων, καυτά φλερτ, ζήλια, χωρισμοί, φλερτ στη δουλειά, άβολα hookups, ατυχήματα με μηνύματα, κρυφοί πόθοι. Μην στηρίζεσαι σε "μηνύματα σε πρώην" ή "stalking πρώην/social media" παρά μόνο σπάνια· είναι απλώς δύο επιλογές ανάμεσα σε πολλές, όχι το προεπιλεγμένο θέμα. Απάντησε ΜΟΝΟ με μία πρόταση, μέχρι 15 λέξεις, χωρίς εισαγωγικά.`,
      user: "Δώσε μια άκρως ακατάλληλη 18+ πρόκληση."
    },
    punishment: {
      system: `Γράφεις αστεία, ανέξοδα και ντροπιαστικά τιμωρήματα εντός σπιτιού για πάρτι. Ποικίλλε ευρέως τον μηχανισμό - τιμωρήματα με το κινητό, φωνητικά/τραγούδι, σωματικά αστεία, roleplay, εξομολογήσεις - μην επαναλαμβάνεις τον ίδιο μηχανισμό δύο φορές στη σειρά. Απάντησε ΜΟΝΟ με μία ποινή, μέχρι 12 λέξεις, χωρίς εισαγωγικά.`,
      user: "Δώσε ένα καινούριο αστείο εσωτερικό τιμώρημα για πάρτι."
    }
  }
};

// Rotating topic banks: one is picked at random per request and injected into the prompt so the
// model can't just default to its favorite handful of tropes (e.g. "stalking an ex's socials").
// We also track the last couple of topics used per lang+kind so we don't hand back the same
// topic twice in a row.
const TOPICS = {
  en: {
    chill: [
      "food and snacks", "getting lost or bad directions", "being late", "phone habits",
      "sleep and naps", "group chats", "shopping impulses", "movies and crying",
      "forgetting things", "clumsiness", "small talk fails", "weather complaints",
      "board games and competitiveness", "selfies and photos", "public transport",
      "pets", "cooking disasters", "overreacting to small things"
    ],
    awkward: [
      "money and greed", "social media cringe", "betraying a friend for a prize",
      "family embarrassment", "workplace awkwardness", "weird personal habits",
      "competitiveness", "lying to get out of something", "laziness", "vanity",
      "burner or secret accounts", "conspiracy-style overthinking", "gossiping",
      "being petty", "overreacting in group chats", "fake confidence",
      "secretly judging people", "avoiding responsibility"
    ],
    nsfw: [
      "dating app disasters", "jealousy and breakups", "workplace flirting",
      "awkward hookups", "texting mishaps (not specifically an ex)", "secret desires",
      "one-night-stand regret", "meeting someone's parents gone wrong", "bad kissers",
      "public place hookups", "love triangles", "ghosting", "rebound relationships",
      "flirting to get out of trouble", "toxic relationship patterns", "drunk confessions"
    ],
    punishment: [
      "phone-based dare", "singing or voice dare", "physical silly dare",
      "roleplay or acting dare", "confession dare", "group-decides-your-fate dare",
      "impersonation dare", "dramatic performance dare"
    ]
  },
  el: {
    chill: [
      "φαγητό και σνακ", "να χαθεί ή κακή κατεύθυνση", "αργοπορία", "συνήθειες κινητού",
      "ύπνος", "group chats", "παρορμητικά ψώνια", "ταινίες και κλάμα",
      "να ξεχνάει πράγματα", "αδεξιότητα", "άβολο small talk", "παράπονα για καιρό",
      "επιτραπέζια και ανταγωνισμός", "selfies", "μέσα μεταφοράς",
      "κατοικίδια", "μαγειρικές καταστροφές", "υπερβολική αντίδραση σε μικροπράγματα"
    ],
    awkward: [
      "χρήμα και απληστία", "ντροπή στα social media", "προδοσία φίλου για βραβείο",
      "οικογενειακή αμηχανία", "αμηχανία στη δουλειά", "περίεργες συνήθειες",
      "ανταγωνιστικότητα", "ψέματα για να αποφύγει κάτι", "τεμπελιά", "ματαιοδοξία",
      "κρυφοί λογαριασμοί", "υπερβολική σκέψη τύπου συνωμοσίας", "κουτσομπολιό",
      "μικροπρέπεια", "υπερβολική αντίδραση σε group chat", "ψεύτικη αυτοπεποίθηση",
      "κρυφή κριτική για άλλους", "αποφυγή ευθυνών"
    ],
    nsfw: [
      "καταστροφές σε dating apps", "ζήλια και χωρισμοί", "φλερτ στη δουλειά",
      "άβολα hookups", "ατυχήματα με μηνύματα (όχι απαραίτητα πρώην)", "κρυφοί πόθοι",
      "μεταμέλεια για one-night-stand", "γνωριμία με γονείς που πήγε στραβά", "κακό φιλί",
      "hookup σε δημόσιο μέρος", "ερωτικό τρίγωνο", "ghosting", "σχέση rebound",
      "φλερτ για να γλιτώσει μπελά", "τοξικά μοτίβα σχέσης", "μεθυσμένες εξομολογήσεις"
    ],
    punishment: [
      "τιμώρημα με το κινητό", "τιμώρημα με τραγούδι/φωνή", "σωματικό αστείο τιμώρημα",
      "roleplay τιμώρημα", "τιμώρημα εξομολόγησης", "η ομάδα αποφασίζει την τύχη σου",
      "τιμώρημα μίμησης", "δραματική ερμηνεία"
    ]
  }
};

const recentTopics = new Map(); // key: `${lang}:${kind}` -> array of last used topics

function pickTopic(language, kind) {
  const pool = TOPICS[language]?.[kind] || TOPICS.en[kind];
  const key = `${language}:${kind}`;
  const recent = recentTopics.get(key) || [];

  const candidates = pool.filter(t => !recent.includes(t));
  const chosen = (candidates.length ? candidates : pool)[Math.floor(Math.random() * (candidates.length ? candidates.length : pool.length))];

  const updated = [chosen, ...recent].slice(0, 3); // remember the last 3 to avoid immediate repeats
  recentTopics.set(key, updated);
  return chosen;
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
      
      let kind = "chill";
      if (body.isPunishment) {
        kind = "punishment";
      } else {
        if (body.spiciness === 2) kind = "awkward";
        if (body.spiciness === 3) kind = "nsfw";
      }

      const prompt = prompts[language][kind];
      const topic = pickTopic(language, kind);
      const topicInstruction = language === "el"
        ? `\nΘέμα προς χρήση αυτή τη φορά: "${topic}".`
        : `\nTheme to use this time: "${topic}".`;
      const excluded = Array.isArray(body.exclude) ? body.exclude.slice(-30) : [];
      const exclusionInstruction = excluded.length
        ? `\nDo not repeat these:\n- ${excluded.join("\n- ")}`
        : "";

      const requestBody = JSON.stringify({
        systemInstruction: { parts: [{ text: prompt.system }] },
        contents: [{ role: "user", parts: [{ text: prompt.user + topicInstruction + exclusionInstruction }] }],
        generationConfig: { maxOutputTokens: 256, temperature: 1.1 }
      });

      let text = null;
      const overallDeadline = Date.now() + 10_000; // stay well under the client's request timeout

      for (const model of GEMINI_MODELS) {
        if (Date.now() > overallDeadline) {
          console.warn("Overall AI deadline reached, falling back early.");
          break;
        }
        try {
          const controller = new AbortController();
          const perModelTimeout = setTimeout(() => controller.abort(), 4_000);
          let upstream;
          try {
            upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
              body: requestBody,
              signal: controller.signal
            });
          } finally {
            clearTimeout(perModelTimeout);
          }

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

server.listen(port, () => console.log(`Match It running at http://localhost:${port}`));import { createServer } from "node:http";
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

// All available models from AI Studio
const GEMINI_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite"
];

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
      system: "You write wild, inappropriate, unhinged adult party game prompts. Topics: modern dating disasters, wild hookup habits, texting exes at 3am, spicy bedroom confessions, awkward flirts, and raunchy secrets. NOT always explicit sex—include dating drama, intense flirting, and wild adult life. Reply ONLY with ONE prompt, max 15 words, no quotes.",
      user: "Give me a highly inappropriate, wild 18+ party prompt."
    },
    punishment: {
      system: "You generate funny, actionable indoor party punishments and embarrassing dares (like letting others check phones, sending awkward texts, or silly physical acts). Reply with ONLY ONE punishment, max 12 words, no intro, no quotes.",
      user: "Give me a new funny indoor party punishment."
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
      system: `Γράφεις ακραίες, ακατάλληλες (18+) ερωτήσεις για παρέες. Θέματα: καταστροφικά ραντεβού, άγρια φλερτ, μηνύματα σε πρώην στις 3 τα ξημερώματα, πικάντικα μυστικά κρεβατοκάμαρας. ΟΧΙ πάντα μόνο σεξ, αλλά δράματα σχέσεων, καυτά φλερτ και ενήλικη τρέλα. Απάντησε ΜΟΝΟ με μία πρόταση, μέχρι 15 λέξεις, χωρίς εισαγωγικά.`,
      user: "Δώσε μια άκρως ακατάλληλη 18+ πρόκληση."
    },
    punishment: {
      system: `Γράφεις αστεία, ανέξοδα και ντροπιαστικά τιμωρήματα εντός σπιτιού για πάρτι (όπως να δώσεις το κινητό σου, να στείλεις μήνυμα, ή αστείες πράξεις). Απάντησε ΜΟΝΟ με μία ποινή, μέχρι 12 λέξεις, χωρίς εισαγωγικά.`,
      user: "Δώσε ένα καινούριο αστείο εσωτερικό τιμώρημα για πάρτι."
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
      const overallDeadline = Date.now() + 10_000; // stay well under the client's request timeout

      for (const model of GEMINI_MODELS) {
        if (Date.now() > overallDeadline) {
          console.warn("Overall AI deadline reached, falling back early.");
          break;
        }
        try {
          const controller = new AbortController();
          const perModelTimeout = setTimeout(() => controller.abort(), 4_000);
          let upstream;
          try {
            upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
              body: requestBody,
              signal: controller.signal
            });
          } finally {
            clearTimeout(perModelTimeout);
          }

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
