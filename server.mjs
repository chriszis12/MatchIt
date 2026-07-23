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
      "turn a five-minute story into a podcast.",
      "survive a zombie apocalypse by pure luck.",
      "send a screenshot to the person in the screenshot.",
      "fall asleep during the most exciting movie.",
      "make friends with a stranger in five minutes.",
      "spend all day choosing what to watch.",
      "say they are almost ready while still in bed.",
      "take fifty photos and post none of them.",
      "win an argument using completely made-up facts.",
      "get lost while following a straight road.",
      "eat dessert before the food arrives.",
      "remember an embarrassing moment from ten years ago.",
      "be late to their own birthday party.",
      "start cleaning and end up reading old messages.",
      "believe an obviously fake internet story.",
      "laugh so hard they cannot explain the joke.",
      "make a dramatic exit and immediately come back.",
      "wear sunglasses when there is no sun.",
      "befriend every animal at the party.",
      "forget someone's name seconds after hearing it.",
      "turn a small problem into a full emergency.",
      "say one quick thing and talk for an hour.",
      "accidentally like a photo from five years ago.",
      "buy something just because it was on sale.",
      "open the fridge repeatedly expecting new food.",
      "give excellent advice and never follow it.",
      "text from another room instead of walking over.",
      "plan an entire holiday and never book it.",
      "cry over a fictional character.",
      "become competitive during a completely casual game.",
      "forget their own password after creating it.",
      "order the same meal every single time.",
      "dance confidently without knowing the song.",
      "say they are not hungry and steal everyone's fries.",
      "make everyone wait while choosing the perfect playlist.",
      "turn up with exactly what everyone forgot.",
      "take charge despite having no idea what is happening.",
      "apologize to a chair after bumping into it.",
      "start a new hobby and buy every accessory.",
      "recognize a song after hearing one second of it.",
      "keep a secret for less than five minutes."
    ],
    punishment: [
      "Do your best robot dance for ten seconds.",
      "Speak like a movie villain until your next turn.",
      "Pretend the floor is lava for fifteen seconds.",
      "Sing your next sentence like an opera star.",
      "Walk like a penguin around the room.",
      "Give an acceptance speech for winning absolutely nothing.",
      "Do a slow-motion victory lap around the room.",
      "Act like a cat until someone guesses correctly.",
      "Balance something harmless on your head for ten seconds.",
      "Introduce yourself as a famous superhero.",
      "Make three different animal noises without laughing.",
      "Pretend you are reporting live from a disaster.",
      "Dance with an invisible partner for fifteen seconds.",
      "Sell the nearest object like a television commercial.",
      "Speak only in questions until your next turn.",
      "Do your most dramatic fake faint.",
      "Imitate someone in the group until they guess.",
      "Give everyone a ridiculous royal title.",
      "Walk across the room like it is a fashion runway.",
      "Make up a national anthem for the group.",
      "Hold a serious interview with an imaginary celebrity.",
      "Explain how to make toast like a sports commentator.",
      "Freeze like a statue until someone says your name.",
      "Perform an emotional goodbye to your phone.",
      "Celebrate like you just won an Olympic medal.",
      "Tell a joke using your most serious voice.",
      "Pretend to be a waiter taking everyone's order.",
      "Make a weather forecast for inside the room.",
      "Speak with a dramatic accent for one round.",
      "Create a handshake with the person beside you."
    ]
  },
  el: {
    question: [
      "ξεχνάει γιατί μπήκε σε ένα δωμάτιο.",
      "απαντάει σε μήνυμα μετά από τρεις εργάσιμες.",
      "παραγγέλνει φαγητό και αμέσως ζηλεύει των άλλων.",
      "γελάει την πιο ακατάλληλη στιγμή.",
      "χάνει το κινητό ενώ το κρατάει.",
      "ακυρώνει σχέδια και μετά το γιορτάζει.",
      "φέρνει σνακ αλλά τα τρώει πριν φτάσει.",
      "κάνει μια πεντάλεπτη ιστορία ολόκληρο podcast.",
      "επιβιώνει από ζόμπι μόνο από καθαρή τύχη.",
      "στέλνει screenshot στο άτομο που είναι μέσα.",
      "κοιμάται στην πιο συναρπαστική ταινία.",
      "γίνεται φίλος με έναν άγνωστο σε πέντε λεπτά.",
      "περνάει όλη τη μέρα διαλέγοντας τι θα δει.",
      "λέει πως είναι σχεδόν έτοιμος ενώ είναι στο κρεβάτι.",
      "βγάζει πενήντα φωτογραφίες και δεν ανεβάζει καμία.",
      "κερδίζει καβγά με εντελώς φανταστικά επιχειρήματα.",
      "χάνεται ενώ ακολουθεί έναν ίσιο δρόμο.",
      "τρώει το γλυκό πριν έρθει το φαγητό.",
      "θυμάται ντροπιαστική στιγμή από πριν δέκα χρόνια.",
      "αργεί στο ίδιο του το πάρτι γενεθλίων.",
      "ξεκινάει καθάρισμα και καταλήγει να διαβάζει παλιά μηνύματα.",
      "πιστεύει μια ολοφάνερα ψεύτικη ιστορία στο ίντερνετ.",
      "γελάει τόσο που δεν μπορεί να εξηγήσει το αστείο.",
      "κάνει δραματική έξοδο και επιστρέφει αμέσως.",
      "φοράει γυαλιά ηλίου χωρίς να έχει ήλιο.",
      "γίνεται φίλος με κάθε ζώο που συναντάει.",
      "ξεχνάει ένα όνομα δευτερόλεπτα αφού το ακούσει.",
      "κάνει ένα μικρό πρόβλημα ολόκληρη κατάσταση έκτακτης ανάγκης.",
      "λέει κάτι γρήγορο και μιλάει για μία ώρα.",
      "κάνει κατά λάθος like σε φωτογραφία πέντε χρόνων.",
      "αγοράζει κάτι μόνο και μόνο επειδή είχε έκπτωση.",
      "ανοίγει συνέχεια το ψυγείο περιμένοντας καινούριο φαγητό.",
      "δίνει τέλειες συμβουλές αλλά δεν ακολουθεί καμία.",
      "στέλνει μήνυμα από το διπλανό δωμάτιο.",
      "σχεδιάζει ολόκληρο ταξίδι και δεν κλείνει τίποτα.",
      "κλαίει για έναν φανταστικό χαρακτήρα.",
      "γίνεται ανταγωνιστικός σε ένα εντελώς χαλαρό παιχνίδι.",
      "ξεχνάει τον κωδικό αμέσως μόλις τον φτιάξει.",
      "παραγγέλνει το ίδιο φαγητό κάθε φορά.",
      "χορεύει με αυτοπεποίθηση χωρίς να ξέρει το τραγούδι.",
      "λέει πως δεν πεινάει και κλέβει τις πατάτες όλων.",
      "καθυστερεί τους πάντες διαλέγοντας την τέλεια playlist.",
      "φέρνει ακριβώς αυτό που ξέχασαν όλοι.",
      "αναλαμβάνει τον έλεγχο χωρίς να ξέρει τι συμβαίνει.",
      "ζητάει συγγνώμη από μια καρέκλα όταν τη χτυπάει.",
      "ξεκινάει νέο χόμπι και αγοράζει όλο τον εξοπλισμό.",
      "αναγνωρίζει τραγούδι από το πρώτο δευτερόλεπτο.",
      "κρατάει ένα μυστικό για λιγότερο από πέντε λεπτά."
    ],
    punishment: [
      "Χόρεψε σαν ρομπότ για δέκα δευτερόλεπτα.",
      "Μίλα σαν κακός ταινίας μέχρι τον επόμενο γύρο.",
      "Κάνε πως το πάτωμα είναι λάβα.",
      "Τραγούδησε την επόμενη πρότασή σου σαν όπερα.",
      "Περπάτησε σαν πιγκουίνος γύρω από το δωμάτιο.",
      "Κάνε ευχαριστήριο λόγο επειδή κέρδισες απολύτως τίποτα.",
      "Κάνε έναν γύρο θριάμβου σε αργή κίνηση.",
      "Κάνε τη γάτα μέχρι κάποιος να το μαντέψει.",
      "Ισορρόπησε κάτι ασφαλές στο κεφάλι σου για δέκα δευτερόλεπτα.",
      "Συστήσου σαν να είσαι διάσημος υπερήρωας.",
      "Κάνε τρεις ήχους ζώων χωρίς να γελάσεις.",
      "Κάνε ζωντανό ρεπορτάζ από μια φανταστική καταστροφή.",
      "Χόρεψε με έναν αόρατο παρτενέρ.",
      "Πούλησε το κοντινότερο αντικείμενο σαν τηλεοπτική διαφήμιση.",
      "Μίλα μόνο με ερωτήσεις μέχρι τον επόμενο γύρο.",
      "Κάνε την πιο δραματική ψεύτικη λιποθυμία.",
      "Μιμήσου κάποιον μέχρι να καταλάβει ποιος είναι.",
      "Δώσε σε όλους έναν γελοίο βασιλικό τίτλο.",
      "Περπάτησε στο δωμάτιο σαν πασαρέλα μόδας.",
      "Φτιάξε έναν εθνικό ύμνο για την παρέα.",
      "Πάρε σοβαρή συνέντευξη από έναν φανταστικό διάσημο.",
      "Εξήγησε πώς γίνεται τοστ σαν αθλητικός σχολιαστής.",
      "Μείνε ακίνητος μέχρι κάποιος να πει το όνομά σου.",
      "Αποχαιρέτησε συγκινητικά το κινητό σου.",
      "Πανηγύρισε σαν να κέρδισες ολυμπιακό μετάλλιο.",
      "Πες ένα αστείο με την πιο σοβαρή φωνή σου.",
      "Κάνε τον σερβιτόρο και πάρε παραγγελία από όλους.",
      "Κάνε πρόγνωση καιρού για μέσα στο δωμάτιο.",
      "Μίλα με δραματική προφορά για έναν γύρο.",
      "Φτιάξε χειραψία με το άτομο δίπλα σου."
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
      const kind = body.isPunishment === true ? "punishment" : "question";
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
