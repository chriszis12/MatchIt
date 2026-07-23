# Match It!

A mobile party game that generates “Who is most likely to…” questions and
safe punishments in English or Greek using the Gemini API.

## Run locally

1. Copy `.env.example` to `.env`.
2. Add your Gemini API key to `.env`.
3. Start the app:

   ```bash
   npm start
   ```

4. Open `http://localhost:3000`.

The Gemini API key is used only by the Node server and is never sent to the
browser.
