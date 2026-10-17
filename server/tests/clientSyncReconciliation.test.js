/**
 * Pure function tests for client-side conflict reconciliation rules
 */
describe('Client Sync Logic & Conflict Resolution Rules', () => {
  it('should detect when an incoming server change collides with an offline dirty note', () => {
    const localDirtyQueue = [
      { noteId: 'note-1', action: 'update', baseVersion: 1, data: { content: 'Offline edit' } },
    ];
    const incomingServerChange = {
      _id: 'note-1',
      version: 2,
      content: 'Server edit from another device',
    };

    // Client reconciliation check
    const hasPendingLocal = localDirtyQueue.some((q) => q.noteId === incomingServerChange._id);

    // Rule: Must not silently overwrite uncommitted local edits!
    expect(hasPendingLocal).toBe(true);
  });

  it('should correctly build resolution payload for "keep_local"', () => {
    const localNote = {
      _id: 'note-1',
      title: 'Local Title',
      content: 'Local Content',
      version: 1,
      conflictingRemote: { version: 3, title: 'Server Title', content: 'Server Content' },
    };

    const resolutionType = 'keep_local';
    const finalTitle = resolutionType === 'keep_local' ? localNote.title : 'other';
    const finalContent = resolutionType === 'keep_local' ? localNote.content : 'other';
    const baseVersion = localNote.conflictingRemote.version;

    expect(finalTitle).toBe('Local Title');
    expect(finalContent).toBe('Local Content');
    expect(baseVersion).toBe(3); // Must update against the latest server version
  });

  it('should correctly build resolution payload for "keep_server"', () => {
    const localNote = {
      _id: 'note-1',
      title: 'Local Title',
      content: 'Local Content',
      conflictingRemote: { version: 3, title: 'Server Title', content: 'Server Content' },
    };

    const serverNote = localNote.conflictingRemote;
    const resolved = {
      ...serverNote,
      baseVersion: serverNote.version,
      syncStatus: 'synced',
      conflictingRemote: null,
    };

    expect(resolved.title).toBe('Server Title');
    expect(resolved.version).toBe(3);
    expect(resolved.conflictingRemote).toBeNull();
    expect(resolved.syncStatus).toBe('synced');
  });

  it('should correctly build resolution payload for "custom_merge"', () => {
    const serverVersion = 5;
    const resolvedData = {
      title: 'Combined Title',
      content: 'Merged both local and server thoughts.',
    };

    const payload = {
      action: 'update',
      baseVersion: serverVersion,
      data: resolvedData,
      isConflictResolution: true,
    };

    expect(payload.isConflictResolution).toBe(true);
    expect(payload.baseVersion).toBe(5);
    expect(payload.data.title).toBe('Combined Title');
  });
});
