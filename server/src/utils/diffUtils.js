/**
 * Line-by-line diff computation for visual side-by-side display
 */
function computeLineDiff(contentA = '', contentB = '') {
  const linesA = contentA.split('\n');
  const linesB = contentB.split('\n');

  const setB = new Set(linesB);
  const setA = new Set(linesA);

  const diffA = linesA.map((line) => ({
    text: line,
    type: !setB.has(line) && line.trim() !== '' ? 'removed' : 'unchanged',
  }));

  const diffB = linesB.map((line) => ({
    text: line,
    type: !setA.has(line) && line.trim() !== '' ? 'added' : 'unchanged',
  }));

  return { diffA, diffB };
}

module.exports = { computeLineDiff };
