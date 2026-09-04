import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("ERROR: GEMINI_API_KEY environment variable is missing.");
  process.exit(1);
}

// We'll use the actual latest Gemini 2.0 Flash Thinking experimental model API name
const MODEL = "gemini-3.8-flash";
const webLocalesDir = path.join(__dirname, '../src/locales');
const androidLocalesDir = path.join(__dirname, '../../notewave-android/src/theme/locales');

async function fixTranslation(baseContent, targetContent, languageCode, format) {
  let prompt;
  if (languageCode === 'en') {
    prompt = `You are a professional UX copywriter and native English speaker.
Your task is to review the following English UI text file and fix any grammatical errors, unnatural phrasing, or typos to make it sound highly professional and perfectly native.
CRITICAL RULES:
1. Maintain exactly the same keys and structure.
2. Return ONLY the raw valid ${format.toUpperCase()} code without markdown blocks or any other text.
3. For TypeScript (.ts), ensure it exports an object like the original: \`export default { ... };\`.
4. Keep the exact same variables like {name} or %s if they exist.

English Text to Polish:
\`\`\`
${targetContent}
\`\`\`
`;
  } else {
    prompt = `You are a professional native translator.
I have a base English translation file and a current ${languageCode} translation file.
Your task is to review and fix any grammatical errors, unnatural phrasing, or incorrect translations in the ${languageCode} file to make it sound perfectly native.
CRITICAL RULES:
1. Maintain exactly the same keys and structure.
2. Return ONLY the raw valid ${format.toUpperCase()} code without markdown blocks or any other text.
3. For TypeScript (.ts), ensure it exports an object like the original: \`export default { ... };\`.
4. Keep the exact same variables like {name} or %s if they exist.

Base English:
\`\`\`
${baseContent}
\`\`\`

Current ${languageCode} Translation to Fix:
\`\`\`
${targetContent}
\`\`\`
`;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API Error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    let result = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    // Strip markdown formatting if the model accidentally included it
    if (result.startsWith('```json')) result = result.replace(/^```json\n/, '').replace(/\n```$/, '');
    else if (result.startsWith('```ts')) result = result.replace(/^```ts\n/, '').replace(/\n```$/, '');
    else if (result.startsWith('```typescript')) result = result.replace(/^```typescript\n/, '').replace(/\n```$/, '');
    else if (result.startsWith('```')) result = result.replace(/^```\w*\n/, '').replace(/\n```$/, '');
    return result.trim();
  } catch (error) {
    console.error(`Error processing ${languageCode}:`, error.message);
    return null;
  }
}

async function processWeb() {
  console.log("Processing Web (JSON)...");
  if (!fs.existsSync(webLocalesDir)) {
      console.log("Web locales not found at", webLocalesDir);
      return;
  }
  const enPath = path.join(webLocalesDir, 'en.json');
  const enContent = fs.readFileSync(enPath, 'utf8');

  const files = fs.readdirSync(webLocalesDir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const targetPath = path.join(webLocalesDir, file);
    const targetContent = fs.readFileSync(targetPath, 'utf8');
    const lang = file.replace('.json', '');
    
    console.log(`Fixing ${lang} JSON...`);
    const fixedContent = await fixTranslation(enContent, targetContent, lang, 'json');
    if (fixedContent) {
      fs.writeFileSync(targetPath, fixedContent);
      console.log(`  -> Saved ${file}`);
    }
  }
}

async function processAndroid() {
  console.log("Processing Android (TS)...");
  if (!fs.existsSync(androidLocalesDir)) {
    console.log("Android locales not found at", androidLocalesDir);
    return;
  }
  const enPath = path.join(androidLocalesDir, 'en.ts');
  const enContent = fs.readFileSync(enPath, 'utf8');

  const files = fs.readdirSync(androidLocalesDir).filter(f => f.endsWith('.ts'));
  for (const file of files) {
    const targetPath = path.join(androidLocalesDir, file);
    const targetContent = fs.readFileSync(targetPath, 'utf8');
    const lang = file.replace('.ts', '');
    
    console.log(`Fixing ${lang} TS...`);
    const fixedContent = await fixTranslation(enContent, targetContent, lang, 'ts');
    if (fixedContent) {
      fs.writeFileSync(targetPath, fixedContent);
      console.log(`  -> Saved ${file}`);
    }
  }
}

async function run() {
  await processWeb();
  await processAndroid();
  console.log("Done!");
}

run();
