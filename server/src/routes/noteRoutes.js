const express = require('express');
const router = express.Router();
const {
  getNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
  getNoteHistory,
  restoreNoteVersion,
} = require('../controllers/noteController');

// Standard REST CRUD + OCC
router.get('/', getNotes);
router.post('/', createNote);
router.get('/:id', getNoteById);
router.put('/:id', updateNote);
router.delete('/:id', deleteNote);

// History & Time Travel Restoration
router.get('/:id/history', getNoteHistory);
router.post('/:id/restore', restoreNoteVersion);

module.exports = router;
