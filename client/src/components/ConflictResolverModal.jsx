import { Sparkles, Check, AlertTriangle, ArrowRight, X, RefreshCw, Edit3, Plus, Minus } from 'lucide-react';
import { api } from '../services/api.js';
import { computeLineDiff } from '../services/diffHelper.js';

export default function ConflictResolverModal({
  conflictNote,
  onResolve,
  onClose,
}) {
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [activeTab, setActiveTab] = useState('side_by_side'); // 'side_by_side' | 'custom_merge'
  const [customTitle, setCustomTitle] = useState(conflictNote?.title || '');
  const [customContent, setCustomContent] = useState(conflictNote?.content || '');

  if (!conflictNote || !conflictNote.conflictingRemote) return null;

  const localNote = conflictNote;
  const serverNote = conflictNote.conflictingRemote;

  const { diffA, diffB } = computeLineDiff(localNote.content || '', serverNote.content || '');

  // Request AI Merge Suggestion from Backend (deterministic 3-way or LLM)
  const handleRequestAIMerge = async () => {
    setIsGeneratingAI(true);
    try {
      const res = await api.suggestAIMerge(
        { title: '', content: '' }, // base
        serverNote,
        localNote
      );

      if (res.ok && res.data.suggestion) {
        setAiSuggestion(res.data.suggestion);
        setCustomTitle(res.data.suggestion.mergedTitle);
        setCustomContent(res.data.suggestion.mergedContent);
      } else {
        alert('Could not generate AI suggestion: ' + (res.data?.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Error requesting AI suggestion: ' + err.message);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleApplyResolution = (type, resolvedData) => {
    onResolve(localNote._id, type, resolvedData);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '1050px', maxHeight: '92vh' }}>
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'var(--danger-bg)', padding: '6px', borderRadius: '8px', color: '#f87171' }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Conflict Resolution</h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Concurrent edits detected between your offline version and the server. No data was overwritten.
              </p>
            </div>
          </div>

          <button onClick={onClose} style={{ color: 'var(--text-dim)', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* AI Merge Recommendation Banner */}
        <div
          style={{
            padding: '12px 24px',
            background: 'linear-gradient(90deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))',
            borderBottom: '1px solid rgba(99,102,241,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} color="#a5b4fc" />
            <span style={{ fontSize: '0.85rem', color: '#c7d2fe' }}>
              Want intelligent synthesis? Generate an AI 3-way merge suggestion without losing either party's work.
            </span>
          </div>

          <button
            onClick={handleRequestAIMerge}
            disabled={isGeneratingAI}
            className="btn-primary"
            style={{ fontSize: '0.8rem', padding: '6px 14px' }}
          >
            {isGeneratingAI ? <RefreshCw size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
            <span>{isGeneratingAI ? 'Analyzing...' : 'Generate AI Merge Suggestion'}</span>
          </button>
        </div>

        {/* AI Suggestion Preview Card if generated */}
        {aiSuggestion && (
          <div
            style={{
              margin: '16px 24px 0',
              padding: '14px',
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={16} color="#818cf8" />
                <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#c7d2fe' }}>
                  AI Merge Suggestion ({aiSuggestion.provider})
                </span>
                <span style={{ fontSize: '0.75rem', background: 'rgba(16,185,129,0.2)', color: '#34d399', padding: '1px 6px', borderRadius: '4px' }}>
                  {Math.round(aiSuggestion.confidence * 100)}% Confidence
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    setActiveTab('custom_merge');
                    setCustomTitle(aiSuggestion.mergedTitle);
                    setCustomContent(aiSuggestion.mergedContent);
                  }}
                  className="btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                >
                  <Edit3 size={12} />
                  <span>Edit Suggestion</span>
                </button>
                <button
                  onClick={() =>
                    handleApplyResolution('custom_merge', {
                      title: aiSuggestion.mergedTitle,
                      content: aiSuggestion.mergedContent,
                    })
                  }
                  className="btn-primary"
                  style={{ fontSize: '0.75rem', padding: '4px 12px', background: 'var(--success)' }}
                >
                  <Check size={12} />
                  <span>Approve & Apply AI Merge</span>
                </button>
              </div>
            </div>

            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '8px', fontStyle: 'italic' }}>
              {aiSuggestion.explanation}
            </p>

            <div
              style={{
                fontSize: '0.825rem',
                backgroundColor: 'var(--bg-primary)',
                padding: '10px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                maxHeight: '120px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <strong>{aiSuggestion.mergedTitle}</strong>
              <div style={{ marginTop: '4px' }}>{aiSuggestion.mergedContent}</div>
            </div>
          </div>
        )}

        {/* View Mode Toggle */}
        <div style={{ display: 'flex', gap: '8px', padding: '16px 24px 0' }}>
          <button
            onClick={() => setActiveTab('side_by_side')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: activeTab === 'side_by_side' ? 'var(--primary)' : 'var(--bg-tertiary)',
              color: activeTab === 'side_by_side' ? '#fff' : 'var(--text-muted)',
            }}
          >
            Side-by-Side Comparison
          </button>
          <button
            onClick={() => setActiveTab('custom_merge')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: activeTab === 'custom_merge' ? 'var(--primary)' : 'var(--bg-tertiary)',
              color: activeTab === 'custom_merge' ? '#fff' : 'var(--text-muted)',
            }}
          >
            Manual Merge Editor
          </button>
        </div>

        {/* Side-by-Side Comparison Panel */}
        {activeTab === 'side_by_side' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '16px 24px', flex: 1, overflowY: 'auto' }}>
            {/* Left: Local Version */}
            <div
              style={{
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#818cf8' }}>
                    Your Offline Version
                  </span>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Base Revision: v{localNote.baseVersion || 1}</div>
                </div>

                <button
                  onClick={() => handleApplyResolution('keep_local')}
                  className="btn-primary"
                  style={{ fontSize: '0.75rem', padding: '4px 10px', background: '#4f46e5' }}
                >
                  <Check size={12} />
                  <span>Keep My Version</span>
                </button>
              </div>

              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>
                {localNote.title}
              </div>

              <div
                style={{
                  flex: 1,
                  backgroundColor: 'var(--bg-secondary)',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  lineHeight: 1.6,
                  minHeight: '220px',
                  border: '1px solid var(--border-color)',
                  fontFamily: 'var(--font-mono)',
                  overflowY: 'auto',
                }}
              >
                {diffA.length === 0 || !localNote.content ? (
                  <em style={{ color: 'var(--text-dim)' }}>Empty content</em>
                ) : (
                  diffA.map((line, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '2px 6px',
                        borderRadius: '3px',
                        backgroundColor: line.type === 'removed' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                        color: line.type === 'removed' ? '#fca5a5' : 'var(--text-main)',
                        display: 'flex',
                        gap: '8px',
                      }}
                    >
                      <span style={{ color: 'var(--text-dim)', width: '20px', userSelect: 'none', textAlign: 'right' }}>
                        {idx + 1}
                      </span>
                      <span>{line.type === 'removed' ? '• ' : '  '}{line.text || ' '}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right: Server Version */}
            <div
              style={{
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#34d399' }}>
                    Server Version
                  </span>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Server Revision: v{serverNote.version}</div>
                </div>

                <button
                  onClick={() => handleApplyResolution('keep_server')}
                  className="btn-primary"
                  style={{ fontSize: '0.75rem', padding: '4px 10px', background: '#059669' }}
                >
                  <Check size={12} />
                  <span>Keep Server Version</span>
                </button>
              </div>

              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>
                {serverNote.title}
              </div>

              <div
                style={{
                  flex: 1,
                  backgroundColor: 'var(--bg-secondary)',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  lineHeight: 1.6,
                  minHeight: '220px',
                  border: '1px solid var(--border-color)',
                  fontFamily: 'var(--font-mono)',
                  overflowY: 'auto',
                }}
              >
                {diffB.length === 0 || !serverNote.content ? (
                  <em style={{ color: 'var(--text-dim)' }}>Empty content</em>
                ) : (
                  diffB.map((line, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '2px 6px',
                        borderRadius: '3px',
                        backgroundColor: line.type === 'added' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                        color: line.type === 'added' ? '#86efac' : 'var(--text-main)',
                        display: 'flex',
                        gap: '8px',
                      }}
                    >
                      <span style={{ color: 'var(--text-dim)', width: '20px', userSelect: 'none', textAlign: 'right' }}>
                        {idx + 1}
                      </span>
                      <span>{line.type === 'added' ? '+ ' : '  '}{line.text || ' '}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Manual Merge Live Editor */
          <div style={{ padding: '16px 24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
              Edit and craft the final unified version below, then click "Apply Resolved Merge":
            </p>

            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Merged Title..."
              style={{
                padding: '10px 14px',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: 600,
              }}
            />

            <textarea
              value={customContent}
              onChange={(e) => setCustomContent(e.target.value)}
              placeholder="Combined Merged Content..."
              style={{
                flex: 1,
                minHeight: '250px',
                padding: '14px',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                fontSize: '0.9rem',
                lineHeight: 1.6,
                resize: 'vertical',
                fontFamily: 'var(--font-mono)',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() =>
                  handleApplyResolution('custom_merge', {
                    title: customTitle,
                    content: customContent,
                  })
                }
                className="btn-primary"
                style={{ background: 'var(--success)', padding: '8px 18px' }}
              >
                <Check size={15} />
                <span>Apply Resolved Merge</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            Document ID: <code>{localNote._id}</code>
          </span>

          <button onClick={onClose} className="btn-secondary" style={{ fontSize: '0.8rem' }}>
            Decide Later
          </button>
        </div>
      </div>
    </div>
  );
}
