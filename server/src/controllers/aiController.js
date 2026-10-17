const { generateMergeSuggestion } = require('../services/aiMergeService');

/**
 * POST /api/ai/suggest-merge
 * Generates an intelligent merge suggestion between base, server, and local edits.
 * Works with or without external AI API keys!
 */
async function suggestMerge(req, res) {
  try {
    const { baseNote, remoteNote, localNote } = req.body;

    if (!remoteNote || !localNote) {
      return res.status(400).json({
        success: false,
        error: 'Missing required notes for merge comparison (remoteNote and localNote required).',
      });
    }

    const suggestion = await generateMergeSuggestion({
      baseNote: baseNote || { title: '', content: '' },
      remoteNote,
      localNote,
    });

    return res.status(200).json({
      success: true,
      suggestion,
    });
  } catch (err) {
    console.error('[suggestMerge Error]', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate merge suggestion',
      details: err.message,
    });
  }
}

module.exports = {
  suggestMerge,
};
