// Parse clipboard HTML inside an inert template. Only these formatting elements
// are ever inserted into the live editor; attributes and active content are dropped.
export function cleanEditorHtml(html: string, doc: Document): string {
  const source = doc.createElement('template'); source.innerHTML = html;
  const target = doc.createElement('div');
  const blocked = new Set(['SCRIPT','STYLE','NOSCRIPT','TEMPLATE','SVG','MATH','IFRAME','OBJECT','EMBED','IMG','VIDEO','AUDIO','FORM','INPUT','BUTTON','SELECT','TEXTAREA','LINK','META']);
  const blocks = new Set(['P','DIV','LI','H1','H2','H3','H4','H5','H6','BLOCKQUOTE','PRE','TR']);
  function copy(node: Node, into: Node) {
    if (node.nodeType === 3) { into.appendChild(doc.createTextNode(node.textContent || '')); return; }
    if (node.nodeType !== 1) return;
    const el = node as HTMLElement;
    if (blocked.has(el.tagName)) return;
    if (el.tagName === 'BR') { into.appendChild(doc.createElement('br')); return; }
    const tags: string[] = [];
    if (['B','STRONG'].includes(el.tagName) || /^(bold|[6-9]00)$/.test(el.style.fontWeight)) tags.push('strong');
    if (['I','EM'].includes(el.tagName) || el.style.fontStyle === 'italic') tags.push('em');
    if (el.tagName === 'U' || el.style.textDecorationLine.includes('underline') || el.style.textDecoration.includes('underline')) tags.push('u');
    let parent = into;
    if (blocks.has(el.tagName)) { const paragraph = doc.createElement('p'); parent.appendChild(paragraph); parent = paragraph; }
    for (const tag of tags) { const wrapper = doc.createElement(tag); parent.appendChild(wrapper); parent = wrapper; }
    el.childNodes.forEach(child => copy(child, parent));
  }
  source.content.childNodes.forEach(node => copy(node, target));
  return target.innerHTML;
}
export function clipboardMarkup(transfer: DataTransfer, doc: Document): string {
  const html = transfer.getData('text/html');
  if (html) return cleanEditorHtml(html, doc);
  const text = doc.createElement('div'); text.textContent = transfer.getData('text/plain');
  return text.innerHTML.replace(/\n/g, '<br>');
}
