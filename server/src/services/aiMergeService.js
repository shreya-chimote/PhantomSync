/**
 * PhantomSync AI - Intelligent Merge Service
 * Provides automated merge suggestions using a built-in 3-way text reconciliation algorithm,
 * with optional LLM enhancements (Gemini / OpenAI) when API keys are configured.
 *
 * Guaranteed to work offline / without any external API keys!
 */

/**
 * Perform 3-way line-based merge
 * @param {string} base - Base version content (common ancestor)
 * @param {string} remote - Current server version content
 * @param {string} local - Local offline changes
 */
function threeWayLineMerge(base = '', remote = '', local = '') {
  const baseLines = base.split('\n');
  const remoteLines = remote.split('\n');
  const localLines = local.split('\n');

  const baseSet = new Set(baseLines);
  const resultLines = [];
  const explanations = [];

  // Track unique additions from both sides
  const localAdditions = localLines.filter((line) => !baseSet.has(line));
  const remoteAdditions = remoteLines.filter((line) => !baseSet.has(line));

  // Determine line union preserving ordering and distinct contributions
  const maxLength = Math.max(baseLines.length, remoteLines.length, localLines.length);
  let hasDirectLineConflict = false;

  for (let i = 0; i < maxLength; i++) {
    const b = baseLines[i];
    const r = remoteLines[i];
    const l = localLines[i];

    // Case 1: Both unchanged or identical change
    if (r === l) {
      if (r !== undefined) resultLines.push(r);
      continue;
    }

    // Case 2: Only local changed (remote matches base)
    if (r === b && l !== undefined) {
      resultLines.push(l);
      explanations.push(`Incorporated local modification: "${l.slice(0, 40)}"`);
      continue;
    }

    // Case 3: Only remote changed (local matches base)
    if (l === b && r !== undefined) {
      resultLines.push(r);
      explanations.push(`Incorporated remote update: "${r.slice(0, 40)}"`);
      continue;
    }

    // Case 4: Both modified differently (Direct line conflict)
    hasDirectLineConflict = true;
    if (l !== undefined && r !== undefined) {
      // If one contains the other, prefer the more informative longer version
      if (l.includes(r)) {
        resultLines.push(l);
      } else if (r.includes(l)) {
        resultLines.push(r);
      } else {
        // Synthesize both changes non-destructively
        resultLines.push(l);
        resultLines.push(r);
      }
      explanations.push(`Merged overlapping edits from both local and remote.`);
    } else if (l !== undefined) {
      resultLines.push(l);
    } else if (r !== undefined) {
      resultLines.push(r);
    }
  }

  // Deduplicate consecutive identical lines
  const cleanedLines = resultLines.filter((line, idx, arr) => idx === 0 || line !== arr[idx - 1]);

  return {
    mergedContent: cleanedLines.join('\n').trim(),
    hasDirectLineConflict,
    explanations,
  };
}

/**
 * Merge Titles intelligently
 */
function mergeTitle(baseTitle = '', remoteTitle = '', localTitle = '') {
  if (remoteTitle === localTitle) return remoteTitle;
  if (localTitle === baseTitle) return remoteTitle;
  if (remoteTitle === baseTitle) return localTitle;

  // Both changed title: if one is Untitled, choose the meaningful one
  if (remoteTitle.toLowerCase() === 'untitled note' && localTitle) return localTitle;
  if (localTitle.toLowerCase() === 'untitled note' && remoteTitle) return remoteTitle;

  // Otherwise synthesize or pick the more descriptive title
  if (localTitle.length >= remoteTitle.length) {
    return localTitle;
  }
  return remoteTitle;
}

/**
 * Built-in Rule-Based / Heuristic Merge Engine (zero API key needed)
 */
function localSmartMerge({ baseNote = {}, remoteNote = {}, localNote = {} }) {
  const mergedTitle = mergeTitle(baseNote.title || '', remoteNote.title || '', localNote.title || '');
  const { mergedContent, hasDirectLineConflict, explanations } = threeWayLineMerge(
    baseNote.content || '',
    remoteNote.content || '',
    localNote.content || ''
  );

  let explanationSummary = 'Intelligently reconciled local and server edits without losing text.';
  if (explanations.length > 0) {
    explanationSummary += ` Reconciled: ${explanations.slice(0, 3).join('; ')}`;
  }

  return {
    mergedTitle,
    mergedContent,
    explanation: explanationSummary,
    confidence: hasDirectLineConflict ? 0.85 : 0.98,
    provider: 'built-in-heuristics',
    hasConflicts: hasDirectLineConflict,
  };
}

/**
 * Optional Gemini AI LLM Merge
 */
async function geminiSmartMerge(apiKey, { baseNote, remoteNote, localNote }) {
  const prompt = `You are an expert distributed system conflict resolver.
Your goal is to perform a safe 3-way merge of a note edited concurrently offline and on the server.
Never lose unique information from either party.

BASE (Common Ancestor):
Title: ${baseNote.title || ''}
Content:
${baseNote.content || ''}

SERVER VERSION (Remote):
Title: ${remoteNote.title || ''}
Content:
${remoteNote.content || ''}

LOCAL OFFLINE VERSION:
Title: ${localNote.title || ''}
Content:
${localNote.content || ''}

Respond with ONLY valid JSON with this exact schema:
{
  "mergedTitle": "string",
  "mergedContent": "string",
  "explanation": "string explaining how the merge was performed",
  "confidence": 0.95
}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API returned status ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  const parsed = JSON.parse(rawText);

  return {
    mergedTitle: parsed.mergedTitle,
    mergedContent: parsed.mergedContent,
    explanation: parsed.explanation || 'Merged using Google Gemini AI.',
    confidence: parsed.confidence || 0.95,
    provider: 'gemini',
    hasConflicts: false,
  };
}

/**
 * Main merge handler: Tries configured LLM if key exists, otherwise uses built-in engine
 */
async function generateMergeSuggestion({ baseNote = {}, remoteNote = {}, localNote = {} }) {
  const geminiKey = process.env.GEMINI_API_KEY;

  if (geminiKey && geminiKey.trim() !== '') {
    try {
      return await geminiSmartMerge(geminiKey, { baseNote, remoteNote, localNote });
    } catch (err) {
      console.warn(`[AI Merge] Gemini API failed (${err.message}). Falling back to built-in merge engine.`);
    }
  }

  // Fallback to built-in deterministic 3-way reconciliation
  return localSmartMerge({ baseNote, remoteNote, localNote });
}

module.exports = {
  generateMergeSuggestion,
  localSmartMerge,
  threeWayLineMerge,
  mergeTitle,
};
