/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/**
 * Ported verbatim from legacy/index.html (see git history / legacy/ folder
 * for the original 21MB single-file app). This module is a mechanical copy
 * of the real DOCX exam-mixer parsing/shuffling/regenerating logic, not a
 * reimplementation — the original handles many edge cases (MathType/OLE
 * equation objects, images, Word run-split quirks, clustered "câu hỏi
 * chùm" questions, English exam block detection, fixed/locked questions,
 * multi-row option layouts, exam header/footer policy, pagination) that
 * would be unsafe to rewrite from scratch without real sample files to
 * test against.
 *
 * Entry points:
 * - splitDocumentSmart / analyzeSourceXml — parse a docx body into
 *   sections/questions and classify each one (mcq/tf/short/essay).
 * - shuffleChoicesPro / shuffleTFPro — shuffle MCQ choices / True-False
 *   sub-items for one question, preserving MathType/OLE objects.
 * - buildVariant(xml, opts, analysis, headerInfo) — the real orchestrator:
 *   runs shuffle per question across the whole doc, reassembles the body,
 *   renumbers, applies header/footer policy, and serializes back to XML.
 *   Returns {outXml, printXml, essayAnswerXml, answers, matrixRows, total}.
 * - loadDocxXml(input, displayName) — reads a .docx File/Blob via JSZip
 *   into {zip, xml} (word/document.xml as a string).
 *
 * Full transitive dependency closure of all of the above: 145 helper
 * functions total (58 from the original parse/shuffle pass + 87 added for
 * buildVariant/loadDocxXml), traced and extracted mechanically via an
 * acorn-based call-graph walk, not manual line-range guessing — see
 * scripts used in session history if this needs re-deriving.
 *
 * Deliberately NOT included (LAN/desktop-EXE-specific, Phase 2 scope):
 * makeSimpleDocx, exammixAuditExportedExamDocx, buildPackage, and every
 * _examMix*-prefixed desktop-shell/native-folder-picker helper — confirmed
 * via the same call-graph trace that none of them are hard dependencies of
 * buildVariant or loadDocxXml.
 *
 * Adaptation notes:
 * - analyzeSourceXml's signature gained two optional trailing params
 *   (sourceType = 'docx', sourcePdfMeta = null) that replace legacy
 *   page-global variables of the same name. PDF ingestion was a separate,
 *   not-yet-ported feature in the original; defaulting to 'docx' preserves
 *   the exact original behavior for the DOCX-only pipeline this app
 *   supports today.
 * - loadDocxXml originally relied on a global `JSZip` (loaded via a bundled
 *   UMD script tag). Here it's an ES import of the `jszip` npm package
 *   instead — same library, same API, just module-scoped rather than
 *   window-scoped. No logic changed.
 */

import JSZip from "jszip";

export const W_NS='http://schemas.openxmlformats.org/wordprocessingml/2006/main';

export function shuffle(arr){
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
  return a;
}

export function textOf(el){
  // Đọc phần NỘI DUNG Word và giữ Tab/Break thật để nhận A-B-C-D cùng hàng.
  // Quan trọng: bỏ qua w:pPr. Bên trong pPr cũng có <w:tab> nhưng đó chỉ là
  // khai báo TAB STOP (định dạng), không phải ký tự Tab của nội dung. Nếu tính
  // chúng vào chuỗi, vị trí A/B/C/D bị lệch khi cắt một đoạn có 2 hoặc 4 đáp án.
  let out='';
  const walk=n=>{
    if(!n||n.nodeType!==1)return;
    if(n.localName==='pPr')return;
    if(n.localName==='t'){out+=n.textContent||'';return}
    if(n.localName==='tab'){out+='\t';return}
    if(n.localName==='br'||n.localName==='cr'){out+='\n';return}
    Array.from(n.children||[]).forEach(walk);
  };
  walk(el);return out;
}

export function isQuestionStart(t){
  // Nhận các dạng phổ biến:
  // Câu 1. ; Câu 1: ; Câu 1) ; Câu 1(NB). ; Câu 1 (H). ; Câu 1[TH].
  // Không bắt buộc có ký hiệu mức độ.
  return /^\s*#?\s*(?:Câu|Bài|Question)\s*\d+(?:\s*(?:\[[^\]\r\n]{1,24}\]|\([^\)\r\n]{1,24}\)))?\s*[\.\:\)]?/i.test(t||'');
}

export function isPartHeading(t){
  return /^\s*(?:(?:PHẦN|PHAN|PART|NHÓM|NHOM)\s*(?:I|II|III|IV|V|[1-5])\b|(?:I|II|III|IV|V)\s*[\.\:])/i.test(t||'');
}

export function getQuestionNumber(t){
  const m=(t||'').match(/^\s*#?\s*(?:Câu|Bài|Question)\s*(\d+)/i);
  return m?parseInt(m[1]):null;
}

export function mcqLeadingRegex(q){
  // Dạng sắp xếp Tiếng Anh có các dòng a./b./c./d. là nội dung; chỉ A./B./C./D. viết HOA mới là phương án.
  return (q&&q.englishBlockKind==='arrangement')?/^\s*#?\s*([A-H])[\.\)\:]\s*/:/^\s*#?\s*([A-H])[\.\)\:]\s*/i;
}

export function normalizeKey(s){return (s||'').toUpperCase().replace(/[^A-H]/g,'')}

export function wNode(doc,name,attrs={}){
  const el=doc.createElementNS(W_NS,'w:'+name);
  Object.entries(attrs).forEach(([k,v])=>el.setAttributeNS(W_NS,'w:'+k,String(v)));
  return el;
}

export function questionIsFixed(t){return /^\s*#\s*(?:Câu|Bài|Question)/i.test(t||'')}

export function levelOfQuestion(q){
  // Chỉ để tương thích tài liệu cũ; người dùng KHÔNG cần ghi mức độ.
  const t=textOf(q.els[0]||document.createElement('p'));
  const m=t.match(/(?:\[(NB|TH|H|VD|VDC)\]|\((NB|TH|H|VD|VDC)\))/i);
  return m?(m[1]||m[2]||'').toUpperCase():'';
}

export function isGroupTag(t){return /^\s*<\s*#?g[0-3]\s*>\s*$/i.test(t||'')}

export function parseGroupMode(t){const m=(t||'').match(/<\s*#?g([0-3])\s*>/i);return m?parseInt(m[1]):null}

export function normalizeEnglishPromptText(t){return String(t||'').replace(/[\s\u00A0]+/g,' ').trim()}

export function isEnglishBlockIntro(t){
  const s=normalizeEnglishPromptText(t);
  if(!s)return false;
  if(/^Read the following\b/i.test(s))return true;
  if(/^Questions?\s+\d+\s*[-–—]\s*\d+\s*[.:]?\s*(?:Read|Choose|Mark)\b/i.test(s))return true;
  if(/^Mark the letter A\s*,\s*B\s*,\s*C\s*(?:,|or)\s*D\b/i.test(s))return true;
  if(/^Choose the (?:best|correct)\b/i.test(s) && /question|answer|option/i.test(s))return true;
  return false;
}

export function englishBlockKind(prefix){
  const s=normalizeEnglishPromptText((prefix||[]).map(x=>textOf(x)).join(' '));
  if(/numbered blanks?|fits? each of the numbered blanks?|blank(?:s)? from\s*\d+/i.test(s))return 'cloze';
  if(/best arrangement of utterances|arrangement of utterances or sentences|make a meaningful exchange or text/i.test(s))return 'arrangement';
  if(/^Read the following\b/i.test(s) && /best answer|following questions/i.test(s))return 'reading';
  return 'standalone';
}

export function looksLikeEnglishExam(body){
  const nodes=Array.from(body.children||[]).filter(x=>x.localName!=='sectPr');
  let intro=0,q=0;
  nodes.forEach(el=>{const t=textOf(el).trim();if(isEnglishBlockIntro(t))intro++;if(isQuestionStart(t)&&/^\s*(?:Question|Câu)\s*\d+\b/i.test(t))q++;});
  return intro>=1 && q>=3;
}

export function splitEnglishBlocks(body){
  const children=Array.from(body.children).filter(x=>x.localName!=='sectPr');
  const sectPr=Array.from(body.children).find(x=>x.localName==='sectPr')||null;
  const headers=[],blocks=[];let currentBlock=null,currentQ=null;
  const startBlock=(el)=>{currentBlock={id:blocks.length+1,prefix:[el],questions:[],kind:'',shuffleQuestions:true};blocks.push(currentBlock);currentQ=null};
  for(const el of children){
    const t=textOf(el).trim();
    if(isEnglishBlockIntro(t)){startBlock(el);continue}
    if(isQuestionStart(t)){
      if(!currentBlock){currentBlock={id:blocks.length+1,prefix:[],questions:[],kind:'standalone',shuffleQuestions:true};blocks.push(currentBlock)}
      currentQ={els:[el],originalNum:getQuestionNumber(t),originalIndex:-1,fixed:questionIsFixed(t),groupMode:null,groupId:currentBlock.id,englishBlockId:currentBlock.id};
      currentBlock.questions.push(currentQ);continue;
    }
    if(currentQ){currentQ.els.push(el);continue}
    if(currentBlock){currentBlock.prefix.push(el);continue}
    headers.push(el);
  }
  // Bỏ các block không có câu: trả phần prefix về header để không làm mất nội dung.
  const live=[];
  blocks.forEach(b=>{
    if(!b.questions.length){headers.push(...b.prefix);return}
    b.kind=englishBlockKind(b.prefix);
    b.shuffleQuestions=false; // Safe English exam: keep question numbering aligned with shared material
    b.firstNum=b.questions[0]?.originalNum||1;
    b.lastNum=b.questions[b.questions.length-1]?.originalNum||b.firstNum;
    const introText=normalizeEnglishPromptText(b.prefix.map(x=>textOf(x)).join(' '));
    const stated=introText.match(/^Questions\s+(\d+)\s*[-–—]\s*(\d+)\b/i);
    if(stated){
      const start=Number(stated[1]),end=Number(stated[2]);
      const numbers=b.questions.map(q=>q.originalNum);
      if(end<start||numbers.length!==end-start+1||numbers.some((n,i)=>n!==start+i)){
        throw new Error('Nhóm tiếng Anh Questions '+start+'–'+end+' có '+numbers.length+' câu, hoặc câu không đúng thứ tự. Hãy kiểm tra nguồn Word; dừng trước khi xuất để tránh lệch đoạn đọc.');
      }
    }
    live.push(b);
  });
  let idx=0;const all=[];
  live.forEach((b,bi)=>b.questions.forEach((q,qi)=>{q.originalIndex=idx++;q.sectionIndex=0;q.sectionQuestionIndex=all.length;q.level=levelOfQuestion(q);q.englishBlockId=b.id;q.englishBlockKind=b.kind;q.englishBlockQuestionIndex=qi;all.push(q)}));
  const sec={headers,questions:all,englishBlocks:live,englishMode:true};
  return {sections:[sec],sectPr,total:idx,englishDetected:true,englishBlocks:live};
}

export function splitDocumentSmart(body,useEnglishBlocks=true){
  if(useEnglishBlocks!==false && looksLikeEnglishExam(body))return splitEnglishBlocks(body);
  const p=splitSections(body);p.englishDetected=false;p.englishBlocks=[];return p;
}

export function exClusterHeader(t){
  const x=String(t||'').replace(/\s+/g,' ').trim();
  // Yêu cầu lời dẫn rõ ràng, tránh nhầm câu bình thường có nhắc tới số câu.
  if(!/^(?:đọc|dựa vào|sử dụng|quan sát|cho|xem|hãy đọc|read|refer to|use the following)/i.test(x))return null;
  if(!/(?:câu(?: hỏi)?|questions?)\s*(?:số\s*)?\d+/i.test(x))return null;
  let m=x.match(/(?:câu(?: hỏi)?|questions?)\s*(?:số\s*)?(\d+)\s*(?:đến|tới|[-–—])\s*(?:câu(?: hỏi)?\s*)?(\d+)/i);
  if(!m)m=x.match(/(?:câu(?: hỏi)?|questions?)\s*(?:số\s*)?(\d+)\s*[,; và]+\s*(?:câu(?: hỏi)?\s*)?(\d+)/i);
  if(!m)return null;
  // Nếu là danh sách 5, 6, 7 ... phải lấy hết nhóm, không chỉ 5, 6.
  const after=x.slice(m.index+m[0].length);
  if(/[,; và]+/.test(m[0]) && !/(?:đến|tới|[-–—])/.test(m[0])){
    const trailing=after.match(/^(?:\s*[,;]\s*(?:câu\s*)?\d+)+/i);
    if(trailing){const nums=trailing[0].match(/\d+/g)||[];for(const n of nums){if(Number(n)!==Number(m[2])+1+(nums.indexOf(n)))return null;}m=[m[0],m[1],nums[nums.length-1]];}
  }
  const a=Number(m[1]),b=Number(m[2]);
  if(a<1||b<a||b-a>30)return null;
  return {start:a,end:b};
}

export function splitSections(body){
  const children=Array.from(body.children).filter(x=>x.localName!=='sectPr');
  const sectPr=Array.from(body.children).find(x=>x.localName==='sectPr') || null;
  const sections=[];let sec={headers:[],questions:[]},currentQ=null,groupMode=null,groupId=0,exPending=null,exClusterSeq=0,exActive=null;
  const pushSec=()=>{if(exPending|| (exActive&&exActive.next<=exActive.end))throw new Error('Lời dẫn câu hỏi chùm chưa đủ câu tương ứng. Hãy kiểm tra số câu trong đề gốc.');if(sec.headers.length||sec.questions.length)sections.push(sec);sec={headers:[],questions:[]};currentQ=null;groupMode=null;groupId=0;exPending=null;exActive=null};
  for(const el of children){
    const t=textOf(el).trim();
    if(isPartHeading(t) && (sec.headers.length||sec.questions.length)){pushSec();sec.headers.push(el);continue}
    if(isGroupTag(t)){currentQ=null;groupMode=parseGroupMode(t);groupId++;continue}
    if(/^\s*(?:—\s*)?HẾT(?:\s*—)?\s*$/i.test(t)){
      currentQ=null; sec.headers.push(el); continue;
    }
    const intro=exClusterHeader(t);
    if(intro){
      if(exPending||(exActive&&exActive.next<=exActive.end))throw new Error('Phát hiện lời dẫn câu chùm lồng nhau, cần kiểm tra thủ công.');
      exPending={...intro,prefix:[el],id:++exClusterSeq};currentQ=null;continue;
    }
    if(isQuestionStart(t)){
      const num=getQuestionNumber(t);
      if(exPending){
        if(num!==exPending.start)throw new Error('Lời dẫn yêu cầu câu '+exPending.start+'–'+exPending.end+' nhưng câu tiếp theo là '+num+'.');
        exActive={...exPending,next:num};exPending=null;
      }
      const cluster=exActive;
      if(cluster&&num!==cluster.next)throw new Error('Nhóm câu hỏi chùm '+cluster.start+'–'+cluster.end+' thiếu hoặc sai thứ tự tại câu '+num+'.');
      currentQ={els:[el],originalNum:num,originalIndex:-1,fixed:questionIsFixed(t),groupMode,groupId};
      if(cluster){
        currentQ.exClusterId=cluster.id;currentQ.exClusterStart=cluster.start;currentQ.exClusterEnd=cluster.end;
        if(num===cluster.start)currentQ.exClusterPrefix=cluster.prefix;
        cluster.next++;if(cluster.next>cluster.end)exActive=null;
      }
      sec.questions.push(currentQ);
    }else if(exPending)exPending.prefix.push(el);
    else if(currentQ)currentQ.els.push(el);else sec.headers.push(el);
  }
  pushSec();let idx=0;sections.forEach((ss,si)=>ss.questions.forEach((q,qi)=>{q.originalIndex=idx++;q.sectionIndex=si;q.sectionQuestionIndex=qi;q.level=levelOfQuestion(q)}));
  return {sections,sectPr,total:idx};
}

export function paragraphNodes(q){
  const out=[];q.els.forEach(el=>{if(el.localName==='p')out.push(el);else out.push(...Array.from(el.getElementsByTagNameNS('*','p')))});return out;
}

export function optionMarkersInText(full,upper=true){
  const cls=upper?'A-D':'a-d';
  // Không ăn khoảng trắng sau dấu A./B./C./D; nếu đáp án là MathType/OLE thì công thức không có text.
  const re=new RegExp('(^|[\\s\\u00A0]+)#?\\s*(['+cls+'])[\\.\\)\\:]',upper?'g':'gi');
  const out=[];let m;
  while((m=re.exec(full||''))){
    const start=m.index+(m[1]||'').length;
    out.push({label:m[2],start,matchEnd:re.lastIndex});
  }
  return out;
}

export function cloneRunTextSlice(run,start,end){
  const doc=run.ownerDocument,txt=textOf(run);
  if(start<=0&&end>=txt.length)return run.cloneNode(true);
  const nr=wNode(doc,'r');
  const rPr=Array.from(run.children||[]).find(x=>x.localName==='rPr');
  if(rPr)nr.appendChild(rPr.cloneNode(true));
  const slice=txt.slice(Math.max(0,start),Math.max(0,end));
  if(slice){
    const t=wNode(doc,'t');
    t.setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve');
    t.textContent=slice;nr.appendChild(t);
  }
  return nr;
}

export function cloneParagraphTextRange(p,start,end){
  const doc=p.ownerDocument,np=wNode(doc,'p');
  const pPr=Array.from(p.children||[]).find(x=>x.localName==='pPr');
  if(pPr)np.appendChild(pPr.cloneNode(true));
  const paragraphTextLength=textOf(p).length;
  let off=0;
  Array.from(p.children||[]).forEach(ch=>{
    if(ch.localName==='pPr')return;
    const ct=textOf(ch),len=ct.length;
    if(len===0){
      // OLE/MathType, drawing, pict... có thể hoàn toàn không có text.
      // Quy tắc [start,end) dùng tốt ở giữa đoạn; riêng đối tượng nằm SAU ký tự cuối
      // của phương án D có off === end === paragraphTextLength. Bản cũ bỏ rơi đối tượng
      // cuối này -> mất công thức/giá trị ở phương án D khi xuất.
      const inRange=(off>=start&&off<end) || (off===end&&end===paragraphTextLength&&off>=start);
      if(inRange)np.appendChild(ch.cloneNode(true));
      return;
    }
    const a=Math.max(start,off),b=Math.min(end,off+len);
    if(b>a){
      if(a===off&&b===off+len)np.appendChild(ch.cloneNode(true));
      else if(ch.localName==='r')np.appendChild(cloneRunTextSlice(ch,a-off,b-off));
      else{
        // Biên cắt hiếm khi rơi giữa Equation/Hyperlink. Nếu có, giữ phần chữ để không mất nội dung.
        const r=wNode(doc,'r'),t=wNode(doc,'t');
        t.setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve');
        t.textContent=ct.slice(a-off,b-off);r.appendChild(t);np.appendChild(r);
      }
    }
    off+=len;
  });
  return np;
}

export function trimOptionParagraphSeparators(p){
  // Bỏ Tab/khoảng trắng ngăn cột cũ ở cuối từng phương án sau khi tách.
  // Không xóa MathType/OLE, Equation hay ảnh.
  const hasObjectLike=el=>el&&el.nodeType===1&&(
    el.getElementsByTagNameNS('*','object').length||
    el.getElementsByTagNameNS('*','drawing').length||
    el.getElementsByTagNameNS('*','pict').length||
    el.getElementsByTagNameNS('*','oMath').length||
    el.getElementsByTagNameNS('*','oMathPara').length
  );
  const kids=Array.from(p.childNodes||[]);
  for(let i=kids.length-1;i>=0;i--){
    const ch=kids[i];
    if(ch.nodeType!==1)continue;
    if(ch.localName==='pPr')continue;
    if(hasObjectLike(ch))break;
    const t=textOf(ch);
    if(/^\s*$/.test(t||'')){p.removeChild(ch);continue}
    break;
  }
  return p;
}

export function canonicalizeDirectOptions(q,upper=true){
  // Chuẩn hóa nguồn linh hoạt:
  // A B C D có thể 1 hàng / 2 hàng / 4 hàng -> nội bộ thành 4 đoạn riêng.
  const expected=upper?['A','B','C','D']:['a','b','c','d'];
  const all=[];
  q.els.forEach((el,i)=>{
    if(el.localName!=='p')return;
    const full=textOf(el),marks=optionMarkersInText(full,upper);
    marks.forEach(m=>all.push({...m,el,i,full}));
  });
  const labels=all.map(x=>upper?x.label.toUpperCase():x.label.toLowerCase());
  if(labels.length!==4||labels.join('')!==expected.join(''))return {...q,sourceFlexible:false};

  const byIndex=new Map();
  all.forEach(m=>{if(!byIndex.has(m.i))byIndex.set(m.i,[]);byIndex.get(m.i).push(m)});
  const out=[];
  q.els.forEach((el,i)=>{
    const marks=byIndex.get(i);
    if(!marks){out.push(el.cloneNode(true));return}
    const full=textOf(el),sorted=marks.sort((a,b)=>a.start-b.start);
    // Giữ phần nội dung câu hỏi đứng trước A nếu A nằm cùng đoạn với nội dung câu.
    if(sorted[0].start>0){
      const pre=cloneParagraphTextRange(el,0,sorted[0].start);
      if(textOf(pre).trim()||pre.getElementsByTagNameNS('*','drawing').length||pre.getElementsByTagNameNS('*','pict').length)out.push(pre);
    }
    sorted.forEach((m,j)=>{
      const end=j+1<sorted.length?sorted[j+1].start:full.length;
      const op=cloneParagraphTextRange(el,m.start,end);
      trimOptionParagraphSeparators(op);
      out.push(op);
    });
  });
  const sourceOptionRows=Array.from(byIndex.keys()).sort((a,b)=>a-b).map(i=>byIndex.get(i).length);
  return {...q,els:out,sourceFlexible:[...byIndex.values()].some(arr=>arr.length>1),sourceOptionRows};
}

export function directLabelPositions(q,re){
  const out=[];q.els.forEach((el,i)=>{if(el.localName!=='p')return;const t=textOf(el);const m=t.match(re);if(m)out.push({i,label:m[1],fixed:/^\s*#/.test(t),el})});return out;
}

export function runProps(run){
  const rPr=Array.from(run.children||[]).find(x=>x.localName==='rPr');
  if(!rPr)return {underline:false,color:'',highlight:'',bold:false};
  const by=n=>Array.from(rPr.children).find(x=>x.localName===n);
  const u=by('u'),c=by('color'),h=by('highlight'),b=by('b');
  const uv=u?(u.getAttributeNS(W_NS,'val')||u.getAttribute('w:val')||'single'):'';
  const cv=c?(c.getAttributeNS(W_NS,'val')||c.getAttribute('w:val')||''):'';
  const hv=h?(h.getAttributeNS(W_NS,'val')||h.getAttribute('w:val')||''):'';
  const bv=b?(b.getAttributeNS(W_NS,'val')||b.getAttribute('w:val')||'1'):'';
  return {underline:!!u&&!/^(none|0|false)$/i.test(uv),color:(cv||'').toUpperCase(),highlight:hv||'',bold:!!b&&!/^(0|false)$/i.test(bv)};
}

export function markerForLabel(p,labelRegex){
  const full=textOf(p),m=full.match(labelRegex);if(!m)return null;
  const labelIndex=full.indexOf(m[1]);
  const runs=Array.from(p.getElementsByTagNameNS('*','r'));let off=0, props=null;
  for(const r of runs){const rt=textOf(r),start=off,end=off+rt.length;if(labelIndex>=start&&labelIndex<end){props=runProps(r);break}off=end}
  props=props||{underline:false,color:'',highlight:'',bold:false};
  const allRuns=runs.map(runProps);
  const wholeUnderline=allRuns.some(x=>x.underline);
  const wholeColor=allRuns.find(x=>['FF0000','C00000','0000FF','0070C0'].includes(x.color));
  return {label:m[1],props,wholeUnderline,wholeColor:!!wholeColor};
}

export function getOptionParagraphs(q,upper=true){
  const re=upper?/^\s*#?\s*([A-H])[\.\)\:]\s*/:/^\s*#?\s*([a-d])[\.\)\:]\s*/i;
  return paragraphNodes(q).map(p=>({p,text:textOf(p),m:textOf(p).match(re)})).filter(x=>x.m).map(x=>({...x,label:x.m[1]}));
}

export function chooseMCQAnswer(q){
  const cq=canonicalizeDirectOptions(q,true);
  const opts=getOptionParagraphs(cq,true);
  const direct=directLabelPositions(cq,/^\s*#?\s*([A-H])[\.\)\:]\s*/i);
  if(opts.length<2)return {answer:'',method:'',options:opts,warnings:['không đủ phương án A/B/C/D'],infos:[]};
  const base=[],infos=[];
  if(opts.length!==4)base.push(`có ${opts.length} phương án (không phải 4)`);
  if(cq.sourceFlexible)infos.push('nguồn có phương án cùng hàng/2 hàng — định dạng hợp lệ, đã chuẩn hóa tự động');
  if(direct.length<opts.length)base.push('có phương án trong bảng/khối lồng — chỉ nhận dạng hạn chế');
  const marks=opts.map(o=>({...o,mark:markerForLabel(o.p,/^\s*#?\s*([A-H])[\.\)\:]\s*/)}));
  const findOne=(pred,method)=>{
    const a=marks.filter(x=>pred(x.mark));
    return a.length===1?{answer:a[0].label.toUpperCase(),method,options:marks,warnings:[...base],infos:[...infos]}:
      a.length>1?{answer:'',method:'',options:marks,warnings:[...base,'có nhiều phương án cùng được đánh dấu '+method],infos:[...infos]}:null;
  };
  let r=findOne(m=>m&&m.props.underline,'gạch chân ký tự');if(r)return r;
  r=findOne(m=>m&&['FF0000','C00000','0000FF','0070C0'].includes(m.props.color),'màu ký tự');if(r)return r;
  r=findOne(m=>m&&m.wholeUnderline,'gạch chân nội dung');if(r)return r;
  r=findOne(m=>m&&m.wholeColor,'màu nội dung');if(r)return r;
  r=findOne(m=>m&&m.props.highlight,'highlight');if(r)return r;
  const bold=marks.filter(x=>x.mark&&x.mark.props.bold);
  if(bold.length===1)return {answer:bold[0].label.toUpperCase(),method:'in đậm ký tự',options:marks,warnings:[...base],infos:[...infos]};
  return {answer:'',method:'',options:marks,warnings:[...base,'chưa thấy đáp án đúng được đánh dấu'],infos:[...infos]};
}

export function explicitTFValue(t){
  const m=(t||'').match(/(?:\[|\()\s*(Đ|D|S)\s*(?:\]|\))\s*$/i);if(!m)return null;return /^(Đ|D)$/i.test(m[1])?'Đ':'S';
}

export function chooseTFAnswer(q){
  const cq=canonicalizeDirectOptions(q,false);
  const items=getOptionParagraphs(cq,false);
  if(items.length<2)return {answer:'',items,warnings:['không nhận diện đủ ý Đúng/Sai A/B/C/D (hoặc a/b/c/d); cần kiểm tra nhãn hoặc bảng lồng'],infos:[]};
  let anyMarker=false;const vals=[];const meta=[];
  for(const it of items){
    const ex=explicitTFValue(it.text),mk=markerForLabel(it.p,/^\s*#?\s*([a-d])[\.\)\:]\s*/i);
    let v,method='';
    if(ex){v=ex;method='ký hiệu [Đ]/[S]';anyMarker=true}
    else if(mk&&(mk.props.underline||mk.wholeUnderline)){v='Đ';method=mk.props.underline?'gạch chân ký tự':'gạch chân nội dung';anyMarker=true}
    else if(mk&&(['FF0000','C00000','0000FF','0070C0'].includes(mk.props.color)||mk.wholeColor)){v='Đ';method='màu';anyMarker=true}
    else v='S';
    vals.push(v);meta.push({...it,value:v,method,mark:mk});
  }
  const warnings=[],infos=[];
  if(items.length!==4)warnings.push('số ý đúng/sai khác 4');
  if(cq.sourceFlexible)infos.push('các ý đúng/sai cùng hàng/2 hàng — định dạng hợp lệ, đã chuẩn hóa tự động');
  if(!anyMarker)warnings.push('không thấy dấu Đ/S hoặc gạch chân; đang hiểu các ý không đánh dấu là Sai');
  return {answer:vals.join(''),items:meta,warnings,infos};
}

export function tlAnswerFromQuestion(q){
  const rx=/(?:^|\s)(?:TL|ĐA|ĐÁP\s*ÁN|DAP\s*AN)\s*:\s*(\([^\r\n]*?\)|[^\r\n]+?)\s*$/i;
  for(const el of q.els){
    const t=textOf(el).trim(),m=t.match(rx);
    if(m){let a=m[1].trim();if(/^\(.*\)$/.test(a))a=a.slice(1,-1).trim();return {answer:a,element:el}}
  }
  return {answer:'',element:null};
}

export function isEssayAnswerStart(t){
  return /(?:^|\s)(?:TL|ĐA|ĐÁP\s*ÁN|DAP\s*AN)\s*:/i.test(t||'') ||
         /^\s*(?:Lời\s*giải|Hướng\s*dẫn(?:\s*giải|\s*chi\s*tiết)?|Giải\s*thích|Đáp\s*án\s*chi\s*tiết)\s*[:\.]?/i.test(t||'');
}

export function essayAnswerFromQuestion(q){
  let startIndex=-1;
  for(let i=0;i<q.els.length;i++){
    if(isEssayAnswerStart(textOf(q.els[i]).trim())){startIndex=i;break}
  }
  if(startIndex<0) return {answer:'',startIndex:-1,warnings:['chưa thấy TL:/ĐA:/Lời giải: cho câu tự luận']};
  let raw=q.els.slice(startIndex).map(e=>textOf(e)).join('\n').trim();
  raw=raw.replace(/^\s*(?:TL|ĐA|ĐÁP\s*ÁN|DAP\s*AN)\s*:\s*/i,'')
         .replace(/^\s*(?:Lời\s*giải|Hướng\s*dẫn(?:\s*giải|\s*chi\s*tiết)?|Giải\s*thích|Đáp\s*án\s*chi\s*tiết)\s*[:\.]?\s*/i,'')
         .trim();
  return {answer:raw||'(có khối lời giải)',startIndex,warnings:[]};
}

export function sectionLabel(section){return section.headers.map(h=>textOf(h).trim()).find(t=>isPartHeading(t))||''}

export function sectionPartNo(section){
  const t=sectionLabel(section).toUpperCase();
  if(/(?:PHẦN|PHAN|PART|NHÓM|NHOM)\s*(?:I\b|1\b)|^I[\.:]/.test(t))return 1;
  if(/(?:PHẦN|PHAN|PART|NHÓM|NHOM)\s*(?:II\b|2\b)|^II[\.:]/.test(t))return 2;
  if(/(?:PHẦN|PHAN|PART|NHÓM|NHOM)\s*(?:III\b|3\b)|^III[\.:]/.test(t))return 3;
  if(/(?:PHẦN|PHAN|PART|NHÓM|NHOM)\s*(?:IV\b|4\b)|^IV[\.:]/.test(t))return 4;
  return 0;
}

export function exammixDistinctOptionLabels(q,upper){
  const labels=[];
  for(const el of (q?.els||[])){
    if(el.localName!=='p')continue;
    const t=textOf(el)||'';
    // Nhận cả A. đáp án, A. ... B. ..., và chuỗi bị dính "nhau.D.".
    // Phân biệt chữ hoa A–D và chữ thường a–d để không coi A–D là ý Đ/S.
    const re=upper?/(?:^|[\s.,;:!?])([A-D])[.)](?=\s|\S|$)/g:/(?:^|[\s.,;:!?])([a-d])[.)](?=\s|\S|$)/g;
    let m;while((m=re.exec(t)))labels.push(m[1]);
  }
  return labels;
}

export function detectQuestionType(q,section){
  const pn=sectionPartNo(section);
  if(pn===1)return 'mcq';if(pn===2)return 'tf';if(pn===3)return 'short';if(pn===4)return 'essay';
  if(tlAnswerFromQuestion(q).answer)return 'short';
  const uppercase=exammixDistinctOptionLabels(q,true);
  const lowercase=exammixDistinctOptionLabels(q,false);
  // Một câu có A/B/C/D viết hoa là trắc nghiệm kể cả khi thiếu nhãn B,
  // nhãn lặp hoặc các phương án ghép trên cùng một hàng Word.
  // Không được đổi loại câu sang Đ/S chỉ vì phương án A–D có lỗi trình bày.
  if(uppercase.length>=2 && (uppercase[0]==='A'||new Set(uppercase).size>=3))return 'mcq';
  if(lowercase.length>=2 && uppercase.length===0)return 'tf';
  // Giữ nhánh nhận dạng cũ cho trường hợp không rõ chữ hoa/thường.
  if(q&&q.englishBlockId){
    const emq=canonicalizeDirectOptions(q,true);
    if(getOptionParagraphs(emq,true).length>=2)return 'mcq';
  }
  const mq=canonicalizeDirectOptions(q,true);
  if(getOptionParagraphs(mq,true).length>=2)return 'mcq';
  const tq=canonicalizeDirectOptions(q,false);
  if(getOptionParagraphs(tq,false).length>=2)return 'tf';
  return 'other';
}

export function parseManualTF(s){return (s||'').split(/[\n;,]+/).map(x=>x.toUpperCase().replace(/D/g,'Đ').replace(/T/g,'Đ').replace(/F/g,'S').replace(/[^ĐS]/g,'')).filter(Boolean)}

export function parseManualShort(s){return (s||'').split(/\n|;/).map(x=>x.trim()).filter(Boolean)}

export function exammixDiagnosticParagraphText(el){
  let out='';
  const fingerprint = n => {
    const xml=new XMLSerializer().serializeToString(n);
    let h=2166136261;
    for(let i=0;i<xml.length;i++){h=Math.imul(h^xml.charCodeAt(i),16777619)}
    return (h>>>0).toString(16);
  };
  const walk=n=>{
    if(!n||n.nodeType!==1)return;
    const name=n.localName;
    if(name==='pPr')return;
    if(name==='oMath'||name==='oMathPara'||name==='object'||name==='pict'||name==='drawing'){
      // A distinct opaque token prevents a math-only answer from being considered empty
      // and prevents two different Equation objects with the same flattened text
      // from being diagnosed as duplicate answers.
      out+=' [ĐỐI_TƯỢNG_'+fingerprint(n)+'] ';
      return;
    }
    if(name==='t'){out+=n.textContent||'';return}
    if(name==='tab'){out+='\t';return}
    if(name==='br'||name==='cr'){out+='\n';return}
    Array.from(n.children||[]).forEach(walk);
  };
  walk(el);return out;
}

export function exammixDiagnosticOptions(q){
  const out=[];
  (q.els||[]).forEach(el=>{
    if(el.localName!=='p')return;
    const whole=exammixDiagnosticParagraphText(el);
    const marks=optionMarkersInText(whole,true);
    marks.forEach((m,i)=>{
      const end=i+1<marks.length?marks[i+1].start:whole.length;
      out.push({label:m.label.toUpperCase(),content:whole.slice(m.matchEnd,end).replace(/[\s\u00a0]+/g,' ').trim()});
    });
  });
  return out;
}

export function exammixV18InspectQuestion(q,type,part,number){
  const out=[];const add=(kind,detail,fix)=>out.push(`Phần ${part}, câu ${number} — ${kind}: ${detail}. Đề xuất: ${fix}.`);
  const normalized=t=>(t||'').normalize('NFC').replace(/[\s\u00a0]+/g,' ').trim().toLocaleLowerCase('vi');
  if(type==='mcq'){
    const opts=exammixDiagnosticOptions(q);
    if(opts.length===4 && opts.map(x=>x.label).join('')==='ABCD'){
      const unique=new Map();
      opts.forEach(x=>{const val=normalized(x.content);if(!val)return;const old=unique.get(val);if(old)add('Phương án trùng nội dung',`${old} và ${x.label} giống nhau (“${x.content.slice(0,95)}”)`,'xem lại nội dung hoặc xác nhận cố ý trùng');else unique.set(val,x.label)});
    }
  }
  if(type==='tf'){
    const parts=[];
    (q.els||[]).forEach(el=>{if(el.localName!=='p')return;const t=textOf(el).trim();const m=t.match(/^([a-dA-D])\s*[.)]\s*/);if(m)parts.push(m[1].toLowerCase())});
    if(parts.length && (parts.length!==4||new Set(parts).size!==4))add('Nhãn ý Đúng/Sai',`phát hiện ${parts.join(', ')} thay vì đủ a, b, c, d`,'kiểm tra từng ý, kể cả đoạn xuống dòng hoặc bảng Word');
  }
  return out;
}

export function analyzeSourceXml(xml,manual={},sourceType='docx',sourcePdfMeta=null){// sourceType/sourcePdfMeta: adapted params, replacing the legacy page-global state (PDF ingestion is a separate, not-yet-ported feature; defaults to 'docx' so this behaves exactly as the DOCX pipeline did)
  const doc=new DOMParser().parseFromString(xml,'application/xml'),body=doc.getElementsByTagNameNS('*','body')[0];
  const parsed=splitDocumentSmart(body,manual.englishBlockMode!==false);const byOriginalIndex={};const warnings=[],infos=[],issueRecords=[];const counts={mcq:0,tf:0,short:0,essay:0,other:0};let found=0;
  const mcqManual=normalizeKey(manual.mcq||''),tfManual=parseManualTF(manual.tf||''),shortManual=parseManualShort(manual.short||'');
  let mi=0,ti=0,si=0;const nums=[];
  parsed.sections.forEach((sec,sidx)=>sec.questions.forEach(q=>{
    nums.push(q.originalNum);const type=detectQuestionType(q,sec);counts[type]=(counts[type]||0)+1;let auto={answer:'',warnings:[]},manualAns='';
    if(type==='mcq'){auto=chooseMCQAnswer(q);manualAns=mcqManual[mi++]||''}
    else if(type==='tf'){auto=chooseTFAnswer(q);manualAns=tfManual[ti++]||''}
    else if(type==='short'){auto=tlAnswerFromQuestion(q);auto.warnings=auto.answer?[]:['chưa thấy dòng TL:(đáp án)'];manualAns=shortManual[si++]||''}
    else if(type==='essay'){auto=essayAnswerFromQuestion(q);manualAns=''}
    const answer=manualAns||(manual.autoDetect===false?'':auto.answer)||'';if(answer)found++;
    const detail={originalIndex:q.originalIndex,number:q.originalNum,type,answer,autoAnswer:auto.answer||'',manualAnswer:manualAns,method:auto.method||'',autoMeta:auto,level:q.level||'',fixed:q.fixed,sectionIndex:sidx};
    byOriginalIndex[q.originalIndex]=detail;
    issueRecords.push({originalIndex:q.originalIndex,sectionIndex:sidx,number:q.originalNum||q.originalIndex+1,type,
      preview:(q.els||[]).map(el=>textOf(el)).filter(Boolean).join('\n').slice(0,4500),
      warningsStart:warnings.length});
    // Nếu đã nhập đáp án thủ công, bỏ cảnh báo chỉ liên quan đến việc không tìm thấy đáp án tự động.
    (auto.warnings||[]).forEach(w=>{if(!manualAns || /không đủ|nhiều phương án|số ý/i.test(w))warnings.push(`Câu ${q.originalNum||q.originalIndex+1}: ${w}`)});
    (auto.infos||[]).forEach(info=>infos.push(`Câu ${q.originalNum||q.originalIndex+1}: ${info}`));
    // Liên kết lỗi với đúng câu và phần, kể cả khi số câu lặp lại ở Phần II.
    issueRecords[issueRecords.length-1].issues=warnings.slice(issueRecords[issueRecords.length-1].warningsStart);
    if(type==='mcq'){
      const labs=mcqLabelsAnywhere(q);
      const expected='ABCD';
      if(labs.length!==4 || labs.join('')!==expected){
        warnings.push(`Phần ${sidx+1}, câu ${q.originalNum||q.originalIndex+1}: lỗi nhận diện phương án A–D; đọc được ${labs.join(', ')||'không có nhãn'}. Kiểm tra các phương án trong Word gốc.`);
      }
      const ops=exammixOptionContentList(q);
      ops.forEach(opt=>{if(!opt.content && !countQuestionObjects({els:q.els}))warnings.push(`Phần ${sidx+1}, câu ${q.originalNum||q.originalIndex+1}, phương án ${opt.label}: không đọc được nội dung (có thể bị trống/mất chữ).`)});
    }
    exammixV18InspectQuestion(q,type,sidx+1,q.originalNum||q.originalIndex+1).forEach(w=>warnings.push(w));
    issueRecords[issueRecords.length-1].issues=warnings.slice(issueRecords[issueRecords.length-1].warningsStart);
  }));
  // Số câu có thể khởi động lại từ 1 ở mỗi PHẦN, vì vậy chỉ kiểm tra trùng trong từng phần.
  parsed.sections.forEach((sec,si)=>{const a=sec.questions.map(q=>q.originalNum).filter(Number.isFinite),dup=[...new Set(a.filter((x,i)=>a.indexOf(x)!==i))];if(dup.length)warnings.push(`Phần ${si+1} có số câu trùng: ${dup.join(', ')}`)});
  // Check numbering only within each section: Part II and III legitimately restart at 1.
  parsed.sections.forEach((sec,si)=>{
    const ns=sec.questions.map(q=>q.originalNum).filter(Number.isFinite);
    for(let j=1;j<ns.length;j++){
      if(ns[j]>ns[j-1]+1)warnings.push(`Phần ${si+1}: nhảy số câu ${ns[j-1]} → ${ns[j]}; kiểm tra câu bị thiếu hoặc bị nhận dạng sai.`);
      if(ns[j]<ns[j-1])warnings.push(`Phần ${si+1}: thứ tự số câu giảm ${ns[j-1]} → ${ns[j]}; kiểm tra việc đánh số trong đề gốc.`);
    }
  });
  if(parsed.total===0){
    const paras=Array.from(body.getElementsByTagNameNS('*','p')).map(p=>textOf(p).trim()).filter(Boolean);
    const sample=paras.slice(0,8).join(' | ');
    warnings.push('Không phát hiện câu hỏi. Chương trình chấp nhận: “Câu 1.”, “Câu 1:”, “Câu 1)”, kể cả tài liệu cũ dạng “Câu 1(NB).”.');
    if(sample) warnings.push('Một số dòng đầu chương trình đọc được: '+sample.slice(0,600));
  }
  const floating=body.getElementsByTagNameNS('*','anchor').length;
  const inlineImages=body.getElementsByTagNameNS('*','inline').length;
  const fatalErrors=[];
  if(sourceType==='docx'){
    if(floating)fatalErrors.push(`Có ${floating} hình/đối tượng đang ở chế độ Floating. Yêu cầu của chương trình: chọn từng hình trong Word → Layout Options → In Line with Text rồi lưu lại .docx.`);
    if(inlineImages)infos.push(`Đã kiểm tra ${inlineImages} hình Inline With Text — hợp lệ; khi xuất sẽ giữ Inline và căn giữa.`);
  }
  if(parsed.englishDetected){
    const eb=parsed.englishBlocks||[];
    const cloze=eb.filter(b=>b.kind==='cloze').length,reading=eb.filter(b=>b.kind==='reading').length,arr=eb.filter(b=>b.kind==='arrangement').length;
    infos.push(`Đề Tiếng Anh theo khối: ${eb.length} khối · Reading ${reading} · Cloze ${cloze} · Arrangement ${arr}.`);
    infos.push('Reading/Arrangement: đảo câu chỉ trong đúng khối; Cloze có blank đánh số: giữ nguyên thứ tự câu và chỉ đảo A–D.');
  }
  if(sourceType==='pdf' && sourcePdfMeta){
    infos.push(`Nguồn PDF: ${sourcePdfMeta.pages} trang, ${sourcePdfMeta.totalChars} ký tự trích xuất.`);
    if(sourcePdfMeta.imageCount) warnings.push(`PDF có khoảng ${sourcePdfMeta.imageCount} hình/đối tượng đồ họa; bản PDF text-only không giữ các hình này khi xuất Word.`);
    warnings.push('PDF không bảo toàn thuộc tính gạch chân như DOCX; nếu đáp án không nhận được, hãy nhập đáp án thủ công trước khi trộn.');
  }
  return {parsed,total:parsed.total,counts,found,warnings,infos,fatalErrors,inlineImages,floating,byOriginalIndex,issueRecords,englishDetected:!!parsed.englishDetected,englishBlocks:parsed.englishBlocks||[]};
}

export function replaceLeadingOptionLabel(el,oldLabel,newLabel){
  // Không giả định “C.” nằm trong cùng một w:t. Word/MathType thường tách thành
  // run “C” + run “. ”. Bản cũ chỉ tìm trong từng w:t nên đổi nhãn thất bại,
  // dẫn đến A/B/C/C, A/B/B/D... sau khi đảo.
  const full=textOf(el);
  const m=full.match(/^(\s*#?\s*)([A-Ha-h])(?=[\.\)\:])/);
  if(!m || m[2].toLowerCase()!==String(oldLabel).toLowerCase())return false;
  const labelIndex=m[1].length;
  let off=0,done=false;
  const walk=n=>{
    if(done||!n||n.nodeType!==1)return;
    if(n.localName==='pPr')return;
    if(n.localName==='t'){
      const txt=n.textContent||'',end=off+txt.length;
      if(labelIndex>=off&&labelIndex<end){
        const k=labelIndex-off;
        n.textContent=txt.slice(0,k)+newLabel+txt.slice(k+1);
        done=true;return;
      }
      off=end;return;
    }
    if(n.localName==='tab'||n.localName==='br'||n.localName==='cr'){off+=1;return}
    Array.from(n.children||[]).forEach(walk);
  };
  walk(el);return done;
}

export function specialFixedOption(t){return /tất\s*cả\s*các\s*(?:phương\s*án|đáp\s*án)|các\s*(?:phương\s*án|đáp\s*án)\s*trên|cả\s+[A-H]\s+và\s+[A-H]/i.test(t||'')}

export function shuffleChoicesPro(q,answer,opts){
  let pos=directLabelPositions(q,mcqLeadingRegex(q));if(pos.length<2)return {question:q,newAnswer:answer,shuffled:false};
  pos=pos.sort((a,b)=>a.i-b.i);pos.forEach(x=>{if(opts.autoFixSpecial&&specialFixedOption(textOf(x.el)))x.fixed=true});
  const movable=pos.filter(x=>!x.fixed);if(movable.length<2){const clean={...q,els:q.els.map(e=>e.cloneNode(true))};pos.forEach(x=>replaceLeadingOptionLabel(clean.els[x.i],x.label,x.label.toUpperCase()));return {question:clean,newAnswer:answer,shuffled:false}}
  const shuffled=shuffle(movable),out=q.els.map(e=>e.cloneNode(true)),mapping={};
  pos.filter(x=>x.fixed).forEach(x=>{replaceLeadingOptionLabel(out[x.i],x.label,x.label.toUpperCase());mapping[x.label.toUpperCase()]=x.label.toUpperCase()});
  movable.forEach((target,j)=>{const src=shuffled[j],clone=src.el.cloneNode(true),newLabel=target.label.toUpperCase();replaceLeadingOptionLabel(clone,src.label,newLabel);out[target.i]=clone;mapping[src.label.toUpperCase()]=newLabel});
  return {question:{...q,els:out},newAnswer:answer?(mapping[answer.toUpperCase()]||answer):'',shuffled:true};
}

export function countQuestionObjects(q){
  let n=0;
  (q.els||[]).forEach(el=>{
    n+=el.getElementsByTagNameNS('*','object').length;
    n+=el.getElementsByTagNameNS('*','drawing').length;
    n+=el.getElementsByTagNameNS('*','pict').length;
    n+=el.getElementsByTagNameNS('*','oMath').length;
    n+=el.getElementsByTagNameNS('*','oMathPara').length;
  });
  return n;
}

export function mcqLabelsAnywhere(q){
  const labels=[];
  (q.els||[]).forEach(el=>{
    if(el.localName!=='p')return;
    optionMarkersInText(textOf(el),true).forEach(m=>labels.push(m.label.toUpperCase()));
  });
  return labels;
}

export function exammixOptionContentList(q){
  const results=[];
  (q.els||[]).forEach(el=>{
    if(el.localName!=='p')return;
    const whole=textOf(el),marks=optionMarkersInText(whole,true);
    marks.forEach((mark,i)=>{
      const limit=i+1<marks.length?marks[i+1].start:whole.length;
      const raw=whole.slice(mark.matchEnd,limit).replace(/[\s\u00a0]+/g,' ').trim();
      results.push({label:mark.label.toUpperCase(),content:raw});
    });
  });
  return results;
}

export function normalizePartToken(x){
  const v=String(x||'').trim().toUpperCase();
  const m={I:1,II:2,III:3,IV:4,'1':1,'2':2,'3':3,'4':4};
  return m[v]||0;
}

export function parseFixedQuestionSpecs(raw){
  return String(raw||'').split(/[;,\n]+/).map(x=>x.trim()).filter(Boolean).map(tok=>{
    let m=tok.match(/^(I{1,3}|IV|[1-4])\s*[:\.\-]\s*(\d+)$/i);
    if(m)return {part:normalizePartToken(m[1]),num:Number(m[2])};
    m=tok.match(/^(\d+)$/);if(m)return {part:0,num:Number(m[1])};
    return null;
  }).filter(Boolean);
}

export function parseFixedTFSpecs(raw){
  return String(raw||'').split(/[;,\n]+/).map(x=>x.trim()).filter(Boolean).map(tok=>{
    let m=tok.match(/^(I{1,3}|IV|[1-4])\s*[:\.\-]\s*(\d+)\s*[:\.\-]?\s*([a-d])$/i);
    if(m)return {part:normalizePartToken(m[1]),num:Number(m[2]),label:m[3].toLowerCase()};
    m=tok.match(/^(\d+)\s*[:\.\-]?\s*([a-d])$/i);
    if(m)return {part:0,num:Number(m[1]),label:m[2].toLowerCase()};
    return null;
  }).filter(Boolean);
}

export function questionMatchesFixedSpec(q,partNo,opts){
  const n=Number(q?.originalNum);if(!Number.isFinite(n))return false;
  const specs=Array.isArray(opts?.fixedQuestionSpecs)?opts.fixedQuestionSpecs:parseFixedQuestionSpecs(opts?.fixedQuestionNums||'');
  return specs.some(x=>x.num===n && (!x.part||x.part===partNo));
}

export function tfLabelMatchesFixedSpec(q,label,partNo,opts){
  const n=Number(q?.originalNum);if(!Number.isFinite(n))return false;
  const specs=Array.isArray(opts?.fixedTFSpecs)?opts.fixedTFSpecs:parseFixedTFSpecs(opts?.fixedTFItems||'');
  return specs.some(x=>x.num===n && x.label===String(label||'').toLowerCase() && (!x.part||x.part===partNo));
}

export function shuffleTFPro(q,answer,opts,partNo){
  let pos=directLabelPositions(q,/^\s*#?\s*([a-d])[\.\)\:]\s*/);if(pos.length<2)return {question:q,newAnswer:answer};pos=pos.sort((a,b)=>a.i-b.i);
  const fixAll=!!opts.fixedAllTFItems && questionMatchesFixedSpec(q,partNo||2,opts);pos.forEach(x=>{if(fixAll||((opts.fixedSpecificTFItems||false)&&tfLabelMatchesFixedSpec(q,x.label,partNo||2,opts)))x.fixed=true});const movable=pos.filter(x=>!x.fixed),sh=shuffle(movable),out=q.els.map(e=>e.cloneNode(true));const sourceValue={};
  pos.forEach((x,i)=>sourceValue[x.label.toLowerCase()]=(answer||'')[i]||'');
  const newVals={};pos.filter(x=>x.fixed).forEach(x=>{replaceLeadingOptionLabel(out[x.i],x.label,x.label.toLowerCase());newVals[x.label.toLowerCase()]=sourceValue[x.label.toLowerCase()]});
  movable.forEach((target,j)=>{const src=sh[j],clone=src.el.cloneNode(true),nl=target.label.toLowerCase();replaceLeadingOptionLabel(clone,src.label,nl);out[target.i]=clone;newVals[nl]=sourceValue[src.label.toLowerCase()]});
  return {question:{...q,els:out},newAnswer:['a','b','c','d'].map(x=>newVals[x]||'').join('')};
}
// --- buildVariant / loadDocxXml + their additional dependency closure ---

export function exammixSetQuestionNumberAcrossRuns(p,n){
  if(!p || p.localName!=='p')return false;
  // Use the same w:t stream for both matching and character offsets.
  // textOf(p) also contains w:tab/w:br, which caused 'Câu 2' to become 'Câu 22'.
  const full=Array.from(p.getElementsByTagNameNS(W_NS,'t')).map(t=>t.textContent||'').join('');
  const m=full.match(/^(\s*#?\s*(?:Câu|Bài|Question)\s*)(\d+)(?=\s*[.：:)]|\s|$)/i);
  if(!m)return false;
  const start=m[1].length,end=start+m[2].length;
  const nodes=Array.from(p.getElementsByTagNameNS('*','t'));
  let offset=0,inserted=false;
  for(const t of nodes){
    const value=t.textContent||'',left=offset,right=left+value.length;
    offset=right;
    if(right<=start || left>=end)continue;
    const from=Math.max(0,start-left),to=Math.min(value.length,end-left);
    const replacement=inserted?'':String(n);
    t.textContent=value.slice(0,from)+replacement+value.slice(to);
    inserted=true;
  }
  return inserted && Number((textOf(p).match(/^\s*#?\s*(?:Câu|Bài|Question)\s*(\d+)/i)||[])[1])===Number(n);
}

export function exammixEnglishQuestionLabel(p){
  if(!p||p.localName!=='p')return false;
  const full=textOf(p),m=full.match(/^\s*Câu\s*(\d+)(?=\s*[.:)]|\s|$)/i);
  if(!m)return /^\s*Question\s*\d+\b/i.test(full);
  const begin=full.search(/Câu\s*\d+/i);
  const wordStart=full.slice(0,begin).length, wordEnd=wordStart+3;
  const nodes=Array.from(p.getElementsByTagNameNS(W_NS,'t'));
  let offset=0,done=false;
  for(const node of nodes){
    const value=node.textContent||'',start=offset,end=start+value.length;offset=end;
    if(end<=wordStart||start>=wordEnd)continue;
    // Label word may span multiple Word text runs; preserve the rest of the sentence.
    const left=Math.max(0,wordStart-start),right=Math.min(value.length,wordEnd-start);
    node.textContent=value.slice(0,left)+(done?'':'Question')+value.slice(right);
    done=true;
  }
  return /^\s*Question\s*\d+\b/i.test(textOf(p));
}

export function renumberQuestion(el,n){
  const p=el&&el.localName==='p'?el:Array.from(el?.getElementsByTagNameNS('*','p')||[])[0];
  if(!p)return false;
  const ok=exammixSetQuestionNumberAcrossRuns(p,n);
  if(ok)boldLeadingQuestionLabel(p);
  return ok;
}

export function exammixAssertQuestionNumber(q,expected,part){
  const first=(q&&q.els||[]).find(e=>e.localName==='p');
  if(!first)return;
  const raw=textOf(first),match=raw.match(/^\s*#?\s*(?:Câu|Bài|Question)\s*(\d+)\b/i);
  if(!match){
    throw new Error(`Phần ${part} · Câu ${expected}: không xác nhận được nhãn số câu sau khi trộn. Nội dung đầu: “${raw.slice(0,85)}”. Đã dừng xuất.`);
  }
  if(Number(match[1])!==Number(expected)){
    throw new Error(`Phần ${part} · Lỗi đánh số: dự kiến Câu ${expected} nhưng Word ghi Câu ${match[1]}. Đã dừng xuất để tránh mã đề sai.`);
  }
}

export function cloneRunWithText(run,text,{bold=null,color=null}={}){
  const nr=run.cloneNode(true);
  Array.from(nr.childNodes).forEach(ch=>{ if(ch.localName!=='rPr') nr.removeChild(ch); });
  let rPr=Array.from(nr.children).find(x=>x.localName==='rPr');
  if(!rPr){rPr=wNode(run.ownerDocument,'rPr');nr.insertBefore(rPr,nr.firstChild)}
  if(bold===true && !Array.from(rPr.children).find(x=>x.localName==='b')) rPr.appendChild(wNode(run.ownerDocument,'b'));
  if(bold===false){
    Array.from(rPr.children).filter(x=>x.localName==='b').forEach(x=>rPr.removeChild(x));
  }
  if(color){
    let rf=Array.from(rPr.children).find(x=>x.localName==='rFonts');
    if(!rf){rf=wNode(run.ownerDocument,'rFonts');rPr.insertBefore(rf,rPr.firstChild)}
    ['ascii','hAnsi','eastAsia','cs'].forEach(k=>rf.setAttributeNS(W_NS,'w:'+k,'Times New Roman'));
    Array.from(rPr.children).filter(x=>x.localName==='color').forEach(x=>rPr.removeChild(x));
    rPr.appendChild(wNode(run.ownerDocument,'color',{val:String(color).replace('#','').toUpperCase()}));
  }
  const t=wNode(run.ownerDocument,'t');
  t.setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve');
  t.textContent=text;
  nr.appendChild(t);
  return nr;
}

export function boldLeadingQuestionLabel(p){
  if(!p || p.localName!=='p') return false;
  const runs=Array.from(p.children).filter(x=>x.localName==='r');
  for(const run of runs){
    const ts=Array.from(run.getElementsByTagNameNS('*','t'));
    for(const t of ts){
      const s=t.textContent||'';
      const m=s.match(/^(\s*)((?:Câu|Bài|Question)\s*\d+\s*[\.\:\)]?)(.*)$/i);
      if(!m) continue;
      const parentRun=t.parentNode;
      const beforeText=m[1]||'', label=m[2]||'', afterText=m[3]||'';
      const created=[];
      if(beforeText) created.push(cloneRunWithText(parentRun,beforeText,{bold:false}));
      if(label) created.push(cloneRunWithText(parentRun,label,{bold:true}));
      if(afterText) created.push(cloneRunWithText(parentRun,afterText,{bold:false}));
      parentRun.parentNode.insertBefore(created[0], parentRun);
      for(let i=1;i<created.length;i++) parentRun.parentNode.insertBefore(created[i], parentRun);
      parentRun.parentNode.removeChild(parentRun);
      return true;
    }
  }
  return false;
}

export function boldLeadingOptionLabel(p){
  // Chế độ "Tạo đề chuẩn": chỉ làm đậm nhãn A./B./C./D., tuyệt đối không làm đậm nội dung phương án.
  // Làm việc cả khi Word tách nhãn thành nhiều run (ví dụ run "A" + run ". ").
  if(!p || p.localName!=='p') return false;
  const full=textOf(p);
  const m=full.match(/^([ \u00A0]*#?[ \u00A0]*)([A-D])([\.\)\:])([ \u00A0]*)/i);
  if(!m) return false;

  // Xóa đúng phần nhãn cũ khỏi các w:t, không đụng Equation/MathType/ảnh ở phía sau.
  let need=m[0].length;
  const ts=Array.from(p.getElementsByTagNameNS('*','t'));
  for(const t of ts){
    if(need<=0) break;
    const s=t.textContent||'';
    if(s.length<=need){t.textContent='';need-=s.length}
    else{t.textContent=s.slice(need);need=0}
  }

  // Tạo nhãn mới thành một run riêng và in đậm; phần nội dung giữ nguyên định dạng riêng của nó.
  const r=wNode(p.ownerDocument,'r'), rPr=wNode(p.ownerDocument,'rPr');
  // Nhãn A–D phải mang font riêng, không được thừa kế font mặc định của Word/WPS.
  rPr.appendChild(wNode(p.ownerDocument,'rFonts',{ascii:'Times New Roman',hAnsi:'Times New Roman',eastAsia:'Times New Roman',cs:'Times New Roman'}));
  rPr.appendChild(wNode(p.ownerDocument,'b'));
  r.appendChild(rPr);
  const t=wNode(p.ownerDocument,'t');
  t.setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve');
  t.textContent=(m[2]||'').toUpperCase()+(m[3]||'.')+' ';
  r.appendChild(t);

  const firstContent=Array.from(p.childNodes).find(n=>!(n.nodeType===1&&n.localName==='pPr'))||null;
  p.insertBefore(r,firstContent);

  // Dọn các run rỗng do phần nhãn cũ bị cắt hết, nhưng không xóa run chứa object/drawing/math.
  Array.from(p.children).filter(x=>x.localName==='r').forEach(run=>{
    const hasObj=run.getElementsByTagNameNS('*','object').length||run.getElementsByTagNameNS('*','drawing').length||run.getElementsByTagNameNS('*','pict').length||run.getElementsByTagNameNS('*','oMath').length;
    if(!hasObj && !textOf(run) && Array.from(run.children).every(ch=>ch.localName==='rPr'||ch.localName==='t')) run.parentNode.removeChild(run);
  });
  return true;
}

export function boldStandardMCQLabels(q){
  (q.els||[]).forEach(el=>{
    if(el.localName!=='p') return;
    if(mcqLeadingRegex(q).test(textOf(el))) boldLeadingOptionLabel(el);
  });
  return q;
}

export function setRunColor(run,color){
  if(!run||run.localName!=='r')return;
  let rPr=Array.from(run.children).find(x=>x.localName==='rPr');
  if(!rPr){rPr=wNode(run.ownerDocument,'rPr');run.insertBefore(rPr,run.firstChild)}
  let rf=Array.from(rPr.children).find(x=>x.localName==='rFonts');
  if(!rf){rf=wNode(run.ownerDocument,'rFonts');rPr.insertBefore(rf,rPr.firstChild)}
  ['ascii','hAnsi','eastAsia','cs'].forEach(k=>rf.setAttributeNS(W_NS,'w:'+k,'Times New Roman'));
  Array.from(rPr.children).filter(x=>x.localName==='color').forEach(x=>rPr.removeChild(x));
  rPr.appendChild(wNode(run.ownerDocument,'color',{val:String(color||'000000').replace('#','').toUpperCase()}));
}

export function colorInlineOptionLabelsInRun(run,color){
  if(!run||run.localName!=='r')return false;
  const hasObj=run.getElementsByTagNameNS('*','object').length||run.getElementsByTagNameNS('*','drawing').length||run.getElementsByTagNameNS('*','pict').length||run.getElementsByTagNameNS('*','oMath').length;
  if(hasObj)return false;
  const txt=textOf(run);if(!txt)return false;
  // Chỉ xử lý nhãn phương án ở đầu đoạn hoặc sau dấu Tab / khoảng trắng căn cột.
  // KHÔNG nhận "A." trong câu như "bố của A. Đang...".
  let p=run;while(p&&p.localName!=='p')p=p.parentNode;
  if(!p)return false;
  const full=textOf(p)||'';
  if(!/^\s*[A-D][.\:)](?=\s|$)/.test(full))return false;
  const allRuns=Array.from(p.getElementsByTagNameNS(W_NS,'r'));
  let offset=0;
  for(const r of allRuns){if(r===run)break;offset+=(textOf(r)||'').length;}
  const candidates=[];
  const regex=/[A-D][.\:)](?=\s|$)/g;
  let m;
  while((m=regex.exec(txt))){
    const pos=offset+m.index;
    const before=full.slice(0,pos);
    const atParagraphStart=/^\s*$/.test(before);
    const atColumnBoundary=/(?:\t\s*| {2,})$/.test(before);
    if(!atParagraphStart&&!atColumnBoundary)continue;
    candidates.push({start:m.index,end:m.index+m[0].length});
  }
  if(!candidates.length)return false;
  const parts=[];let last=0;
  for(const c of candidates){
    if(c.start>last)parts.push({text:txt.slice(last,c.start),label:false});
    parts.push({text:txt.slice(c.start,c.end),label:true});last=c.end;
  }
  if(last<txt.length)parts.push({text:txt.slice(last),label:false});
  const parent=run.parentNode;
  parts.forEach(x=>{if(x.text)parent.insertBefore(cloneRunWithText(run,x.text,x.label?{bold:true,color}:{}),run)});
  parent.removeChild(run);return true;
}

export function setParagraphTextColor(p,color,{bold=null}={}){
  if(!p)return;
  Array.from(p.getElementsByTagNameNS(W_NS,'r')).forEach(r=>{
    if(textOf(r)){
      setRunColor(r,color);
      if(bold===true){let rp=Array.from(r.children).find(x=>x.localName==='rPr');if(!rp){rp=wNode(r.ownerDocument,'rPr');r.insertBefore(rp,r.firstChild)}if(!Array.from(rp.children).some(x=>x.localName==='b'))rp.appendChild(wNode(r.ownerDocument,'b'));}
    }
  });
}

export function colorAllTextRuns(body,color='000000'){
  if(!body)return;
  Array.from(body.getElementsByTagNameNS(W_NS,'r')).forEach(r=>{if(textOf(r))setRunColor(r,color)});
}

export function colorLeadingParagraphLabelAcrossRuns(p,re,color='0000FF'){
  if(!p)return false;
  const full=textOf(p)||'',m=full.match(re);if(!m)return false;
  // Chỉ tô phần NHÃN, không tô khoảng trắng sau nhãn hay nội dung phát biểu.
  // Dùng TOÀN BỘ run hậu duệ để xử lý cả trường hợp Word tách a + ) qua smartTag/hyperlink/run lồng.
  const raw=m[0]||'',labelEnd=raw.replace(/\s+$/,'').length;if(labelEnd<=0)return false;
  let pos=0;
  const runs=Array.from(p.getElementsByTagNameNS(W_NS,'r'));
  for(const r of runs){
    const s=textOf(r)||'';if(!s)continue;
    const a=pos,b=pos+s.length;pos=b;
    if(a>=labelEnd)break;
    const take=Math.min(s.length,labelEnd-a);
    if(take<=0)continue;
    if(take>=s.length){
      setRunColor(r,color);
      let rp=Array.from(r.children).find(x=>x.localName==='rPr');if(!rp){rp=wNode(r.ownerDocument,'rPr');r.insertBefore(rp,r.firstChild)}
      if(!Array.from(rp.children).some(x=>x.localName==='b'))rp.appendChild(wNode(r.ownerDocument,'b'));
    }else{
      const parent=r.parentNode,before=s.slice(0,take),after=s.slice(take);
      if(before)parent.insertBefore(cloneRunWithText(r,before,{bold:true,color}),r);
      if(after)parent.insertBefore(cloneRunWithText(r,after,{}),r);
      parent.removeChild(r);break;
    }
  }
  return true;
}

export function colorExamStructuralLabels(body,color='0000FF'){
  Array.from(body.getElementsByTagNameNS(W_NS,'p')).forEach(p=>{
    const pt=textOf(p)||'';
    // Tiêu đề phần và HẾT: tô xanh như mẫu tham chiếu.
    if(/^\s*PHẦN\s+(?:I|II|III|IV)\b/i.test(pt) || /^\s*[-—–]*\s*HẾT\s*[-—–]*\s*$/i.test(pt)){
      setParagraphTextColor(p,color,{bold:true});return;
    }
    // Câu n. có thể bị Word/MathType tách thành nhiều run -> tô xuyên run.
    colorLeadingParagraphLabelAcrossRuns(p,/^\s*(?:Câu|Bài|Question)\s*\d+\s*[\.\:\)]?\s*/i,color);
    // Ý a), b), c), d) phần Đúng/Sai hoặc tự luận cũng có thể bị tách thành "a" + ")".
    colorLeadingParagraphLabelAcrossRuns(p,/^\s*[a-d][\.\)]\s*/i,color);
    // A./B./C./D. có thể nằm cùng một paragraph/run; chỉ tô nhãn, giữ nội dung đen.
    Array.from(p.children).filter(x=>x.localName==='r').forEach(r=>colorInlineOptionLabelsInRun(r,color));
  });
}

export function makeStandardSectionIntro(doc,partNo,count){
  const nodes=[];
  const addMixed=(boldText,normalText='')=>{
    const p=wNode(doc,'p'), pPr=wNode(doc,'pPr');
    pPr.appendChild(wNode(doc,'spacing',{before:'0',after:'0',line:'240',lineRule:'auto'}));
    p.appendChild(pPr);
    p.appendChild(makeWRun(doc,boldText,{bold:true,size:20}));
    if(normalText) p.appendChild(makeWRun(doc,normalText,{size:20}));
    nodes.push(p);
  };
  const addPlain=(text)=>{
    nodes.push(makeWParagraph(doc,text,{size:20,after:0,before:0,line:240}));
  };
  if(partNo===1){
    addMixed(`PHẦN I. CÂU TRẮC NGHIỆM PHƯƠNG ÁN NHIỀU LỰA CHỌN.`,` Thí sinh trả lời từ câu 1 đến câu ${count}.`);
    addPlain(`Mỗi câu hỏi thí sinh chỉ chọn một phương án.`);
  }else if(partNo===2){
    addMixed(`PHẦN II. CÂU TRẮC NGHIỆM ĐÚNG SAI.`,` Thí sinh trả lời từ câu 1 đến câu ${count}. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.`);
  }else if(partNo===3){
    addMixed(`PHẦN III. CÂU TRẮC NGHIỆM TRẢ LỜI NGẮN.`,` Thí sinh trả lời từ câu 1 đến câu ${count}.`);
  }else if(partNo===4){
    addMixed(`PHẦN IV. TỰ LUẬN.`,` Thí sinh làm bài từ câu 1 đến câu ${count}. Trình bày đầy đủ lời giải.`);
  }
  return nodes;
}

export function parseGroupSizes(s){
  return s.split(',').map(x=>parseInt(x.trim())).filter(x=>Number.isFinite(x)&&x>0);
}

export function addWText(doc,parent,text){
  const t=wNode(doc,'t');
  t.setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve');
  t.textContent=String(text??'');
  parent.appendChild(t);
}

export function makeWRun(doc,text,{bold=false,italic=false,size=22,font='Times New Roman'}={}){
  const r=wNode(doc,'r'), rPr=wNode(doc,'rPr');
  const rFonts=wNode(doc,'rFonts',{ascii:font,hAnsi:font,eastAsia:font});
  rPr.appendChild(rFonts);
  if(bold) rPr.appendChild(wNode(doc,'b'));
  if(italic) rPr.appendChild(wNode(doc,'i'));
  rPr.appendChild(wNode(doc,'sz',{val:size}));
  rPr.appendChild(wNode(doc,'szCs',{val:size}));
  r.appendChild(rPr);
  addWText(doc,r,text);
  return r;
}

export function makeWParagraph(doc,text,{align='left',bold=false,italic=false,size=22,after=0,before=0,line=240}={}){
  const p=wNode(doc,'p'), pPr=wNode(doc,'pPr');
  pPr.appendChild(wNode(doc,'jc',{val:align}));
  pPr.appendChild(wNode(doc,'spacing',{before,after,line,lineRule:'auto'}));
  p.appendChild(pPr);
  if(text!==null && text!==undefined && String(text)!=='') p.appendChild(makeWRun(doc,text,{bold,italic,size}));
  return p;
}

export function makeWCell(doc,lines,widthTwips,align='center'){
  const tc=wNode(doc,'tc'), tcPr=wNode(doc,'tcPr');
  tcPr.appendChild(wNode(doc,'tcW',{w:widthTwips,type:'dxa'}));
  tcPr.appendChild(wNode(doc,'vAlign',{val:'center'}));
  tc.appendChild(tcPr);
  lines.forEach((line,idx)=>{
    if(!line || !String(line.text??'').trim()) return;
    tc.appendChild(makeWParagraph(doc,line.text,{
      align:line.align||align,
      bold:!!line.bold,
      italic:!!line.italic,
      size:line.size||22,
      before:idx===0?0:(line.before||0),
      after:line.after??0,
      line:line.line||240
    }));
  });
  return tc;
}

export function buildExamHeaderNodes(doc,info){
  const tbl=wNode(doc,'tbl'), tblPr=wNode(doc,'tblPr');
  tblPr.appendChild(wNode(doc,'tblW',{w:'9921',type:'dxa'}));
  tblPr.appendChild(wNode(doc,'tblInd',{w:'0',type:'dxa'}));
  tblPr.appendChild(wNode(doc,'tblLayout',{type:'fixed'}));
  const borders=wNode(doc,'tblBorders');
  // Khung chấm/dashed gần giống mẫu ảnh.
  ['top','left','bottom','right','insideV'].forEach(b=>borders.appendChild(wNode(doc,b,{val:'dotted',sz:'8',space:'0',color:'808080'})));
  borders.appendChild(wNode(doc,'insideH',{val:'nil'}));
  tblPr.appendChild(borders);
  tbl.appendChild(tblPr);

  const grid=wNode(doc,'tblGrid');
  grid.appendChild(wNode(doc,'gridCol',{w:'4960'}));
  grid.appendChild(wNode(doc,'gridCol',{w:'4961'}));
  tbl.appendChild(grid);

  const tr=wNode(doc,'tr');
  tr.appendChild(makeWCell(doc,[
    {text:info.agency||'',bold:true,size:22},
    {text:info.school||'',bold:true,size:22},
    {text:info.dept||'',bold:true,size:21,after:0},
    {text:info.examType||'',bold:true,size:20}
  ],4960,'center'));
  tr.appendChild(makeWCell(doc,[
    {text:info.examName||'',bold:true,size:24},
    {text:info.subject||'',bold:true,size:24},
    {text:info.duration||'',italic:true,size:21},
    {text:'MÃ ĐỀ: '+(info.code||''),bold:true,size:25,before:0,after:0}
  ],4961,'center'));
  tbl.appendChild(tr);

  const nodes=[tbl];
  if(info.candidateInfo){
    const p=makeWParagraph(doc,'Họ và tên thí sinh: ............................................................     Số báo danh: ......................',{align:'left',size:21,after:0,before:0,line:240});
    nodes.push(p);
  }
  const rule=makeWParagraph(doc,'',{align:'center',after:0,before:0,line:240});
  const pPr=rule.getElementsByTagNameNS(W_NS,'pPr')[0];
  const pBdr=wNode(doc,'pBdr');
  pBdr.appendChild(wNode(doc,'bottom',{val:'single',sz:8,space:1,color:'808080'}));
  pPr.appendChild(pBdr);
  nodes.push(rule);
  return nodes;
}

export function stripLevelAndLock(el){
  const nodes=Array.from(el.getElementsByTagNameNS('*','t'));
  for(const n of nodes){
    n.textContent=n.textContent.replace(/^\s*#\s*(?=(?:Câu|Bài|Question))/i,'');
    // Không đưa ký hiệu mức độ ra đề học sinh.
    n.textContent=n.textContent.replace(/\s*(?:\[(?:NB|TH|H|VD|VDC)\]|\((?:NB|TH|H|VD|VDC)\))\s*/ig,' ');
    // Dọn khoảng trắng trước dấu chấm sau số câu, ví dụ "Câu 5 ."
    n.textContent=n.textContent.replace(/(Câu\s*\d+)\s+\./i,'$1.');
  }
}

export function exClusterRenameIntro(node,oldStart,oldEnd,newStart,newEnd){
  const t=textOf(node)||'';
  const m=t.match(/(?:câu(?: hỏi)?|questions?)\s*(?:số\s*)?(\d+)\s*(?:đến|tới|[-–—]|[,; và]+)\s*(?:câu(?: hỏi)?\s*)?(\d+)/i);
  if(!m || Number(m[1])!==oldStart || Number(m[2])!==oldEnd)return node;
  const changed=node.cloneNode(true),a=m.index+m[0].indexOf(m[1]),b=m.index+m[0].lastIndexOf(m[2]);
  // Cụm ba câu trở lên: đổi danh sách sang khoảng số liên tiếp, bảo toàn phần ngữ liệu.
  const tail=t.slice(m.index+m[0].length).match(/^(?:\s*[,;]\s*(?:câu\s*)?\d+)+/i);
  if(tail && !/(?:đến|tới|[-–—])/.test(m[0])){
    const begin=m.index+m[0].indexOf(m[1]);
    const finish=m.index+m[0].length+tail[0].length;
    replaceTextSpanAcrossNodes(changed,begin,finish,String(newStart)+' đến câu '+String(newEnd));
    return changed;
  }
  // Sửa số phía sau trước để giữ nguyên offset của số đầu.
  replaceTextSpanAcrossNodes(changed,b,b+m[2].length,String(newEnd));
  replaceTextSpanAcrossNodes(changed,a,a+m[1].length,String(newStart));
  return changed;
}

export function exClusterOrder(qs,opts){
  if(!qs.some(q=>q.exClusterId))return null;
  const units=[];for(let i=0;i<qs.length;){
    const q=qs[i];if(!q.exClusterId){units.push([q]);i++;continue;}
    const group=[];while(i<qs.length&&qs[i].exClusterId===q.exClusterId)group.push(qs[i++]);
    if(group.length!==q.exClusterEnd-q.exClusterStart+1)throw new Error('Nhóm câu hỏi chùm '+q.exClusterStart+'–'+q.exClusterEnd+' không đủ câu. Vui lòng kiểm tra đề gốc.');
    units.push(group);
  }
  // Trộn ĐƠN VỊ, không trộn câu bên trong nhóm; câu cố định không được di chuyển.
  const movable=units.map((unit,i)=>unit.some(q=>q.fixed)?null:i).filter(i=>i!==null);
  const randomized=shuffle(movable.map(i=>units[i]));movable.forEach((i,j)=>units[i]=randomized[j]);
  return units.flat();
}

export function cloneEssayQuestionForAnswer(q,newNo){
  const els=q.els.map(e=>e.cloneNode(true));
  if(els[0]){
    stripLevelAndLock(els[0]);
    renumberQuestion(els[0],newNo);
    boldLeadingQuestionLabel(els[0]);
  }
  return {els};
}

export function buildEssayAnswerXml(xml,headerInfo,essayItems,opts){
  if(!essayItems || !essayItems.length) return '';
  const d=new DOMParser().parseFromString(xml,'application/xml');
  const b=d.getElementsByTagNameNS('*','body')[0];
  const oldSect=Array.from(b.children).find(x=>x.localName==='sectPr');
  while(b.firstChild)b.removeChild(b.firstChild);
  if(opts.injectHeader){
    buildExamHeaderNodes(d,{...headerInfo,candidateInfo:false}).forEach(x=>b.appendChild(x));
  }
  b.appendChild(makeWParagraph(d,'PHẦN IV. ĐÁP ÁN / HƯỚNG DẪN GIẢI TỰ LUẬN',{
    align:'center',bold:true,size:24,before:0,after:0,line:240
  }));
  essayItems.forEach(item=>{
    item.question.els.forEach(e=>b.appendChild(d.importNode(e,true)));
    if(item.missing){
      b.appendChild(makeWParagraph(d,'ĐÁP ÁN: (chưa nhập trong đề gốc)',{bold:true,size:22,before:0,after:0,line:240}));
    }
  });
  if(oldSect){
    const sp=d.importNode(oldSect,true);
    // SAFE_KEEP_STRUCTURE: khi bật giữ nguyên cấu trúc, không ép lại A4/lề
    if(!opts.keepStructure) standardizePage(sp);
    b.appendChild(sp);
  }

  // SAFE_KEEP_STRUCTURE: không chạy các bước có thể làm lệch bố cục Word gốc
  if(!opts.keepStructure){
    centerImageParagraphs(b);
    normalizeParagraphSpacing(b);
    if(opts.normalizeFont) normalizeDocumentRuns(b);
  }

  return new XMLSerializer().serializeToString(d);
}

export function removeChildProp(rPr,name){Array.from(rPr.children).filter(x=>x.localName===name).forEach(x=>rPr.removeChild(x))}

export function sanitizeLabelParagraph(p,isUpper,method='',boldLabel=false){
  const text=textOf(p);const re=isUpper?/^\s*#?\s*([A-H])[\.\)\:]\s*/:/^\s*#?\s*([a-d])[\.\)\:]\s*/;const m=text.match(re);if(!m)return;
  Array.from(p.getElementsByTagNameNS('*','t')).forEach(n=>n.textContent=n.textContent.replace(/^\s*#\s*(?=[A-Ha-d][\.\)\:])/,'') );
  const idx=text.replace(/^\s*#/,'').indexOf(m[1]),runs=Array.from(p.getElementsByTagNameNS('*','r'));let off=0;
  for(const r of runs){
    const rt=textOf(r),end=off+rt.length;
    if(idx>=off&&idx<end){
      let rPr=Array.from(r.children).find(x=>x.localName==='rPr');if(!rPr){rPr=wNode(p.ownerDocument,'rPr');r.insertBefore(rPr,r.firstChild)}
      removeChildProp(rPr,'u');removeChildProp(rPr,'color');removeChildProp(rPr,'highlight');
      if(/in đậm/i.test(method||'')) removeChildProp(rPr,'b');
      break;
    }
    off=end;
  }
  if(/nội dung/i.test(method||'')){
    for(const r of runs){const rp=Array.from(r.children).find(x=>x.localName==='rPr');if(rp){removeChildProp(rp,'u');removeChildProp(rp,'color');removeChildProp(rp,'highlight')}}
  }
}

export function sanitizeInlineMCQParagraph(p,answer,method,boldLabel=false){
  const full=textOf(p),re=/(?:^|\s)#?\s*([A-H])[\.\)\:]\s*/g,runs=Array.from(p.getElementsByTagNameNS('*','r'));let m;
  while((m=re.exec(full))){
    const idx=full.indexOf(m[1],m.index);let off=0;
    for(const r of runs){const end=off+textOf(r).length;if(idx>=off&&idx<end){let rp=Array.from(r.children).find(x=>x.localName==='rPr');if(!rp){rp=wNode(p.ownerDocument,'rPr');r.insertBefore(rp,r.firstChild)}removeChildProp(rp,'u');removeChildProp(rp,'color');removeChildProp(rp,'highlight');if(/in đậm/i.test(method||''))removeChildProp(rp,'b');break}off=end}
  }
  Array.from(p.getElementsByTagNameNS('*','t')).forEach(n=>n.textContent=n.textContent.replace(/(^|\s)#\s*(?=[A-H][\.\)\:])/g,'$1'));
  if(/nội dung/i.test(method||'')){for(const r of runs){const rp=Array.from(r.children).find(x=>x.localName==='rPr');if(rp){removeChildProp(rp,'u');removeChildProp(rp,'color');removeChildProp(rp,'highlight')}}}
}

export function stripExplicitTF(p){Array.from(p.getElementsByTagNameNS('*','t')).forEach(n=>n.textContent=n.textContent.replace(/\s*(?:\[|\()\s*(Đ|D|S)\s*(?:\]|\))\s*$/i,''))}

export function isSolutionStart(t){return /^\s*(?:Lời\s*giải|Hướng\s*dẫn(?:\s*giải|\s*chi\s*tiết)?|Giải\s*thích|Đáp\s*án\s*chi\s*tiết)\s*[:\.]?/i.test(t||'')}

export function isTLLine(t){return /(?:^|\s)(?:TL|ĐA|ĐÁP\s*ÁN|DAP\s*AN)\s*:/i.test(t||'')}

export function removeInlineTLFromElement(el){
  const clone=el.cloneNode(true);
  const nodes=Array.from(clone.getElementsByTagNameNS('*','t'));
  // Ghép text để xác định có TL ở cuối; trường hợp TL là một đoạn riêng sẽ được loại hoàn toàn.
  const full=textOf(clone);
  const m=full.match(/(?:^|\s)(?:TL|ĐA|ĐÁP\s*ÁN|DAP\s*AN)\s*:\s*(?:\([^\r\n]*?\)|[^\r\n]+?)\s*$/i);
  if(!m)return clone;
  const cut=m.index+(m[0].match(/^\s/) ? 1 : 0);
  let off=0;
  for(const n of nodes){
    const s=n.textContent||'',end=off+s.length;
    if(end<=cut){off=end;continue}
    if(off>=cut)n.textContent='';
    else n.textContent=s.slice(0,Math.max(0,cut-off));
    off=end;
  }
  return clone;
}

export function removeEssayAnswerMarkerFromElement(el){
  const full=textOf(el);
  const rx=/(?:^|\s)(?:TL|ĐA|ĐÁP\s*ÁN|DAP\s*AN)\s*:|(?:^|\s)(?:Lời\s*giải|Hướng\s*dẫn(?:\s*giải|\s*chi\s*tiết)?|Giải\s*thích|Đáp\s*án\s*chi\s*tiết)\s*[:\.]?/i;
  const m=full.match(rx);
  if(!m) return el.cloneNode(true);

  // Nếu dòng chỉ là "TL:" / "ĐA:" / "Lời giải:" thì bỏ cả đoạn.
  const before=full.slice(0,m.index).trim();
  if(!before) return null;

  // Nếu nhãn nằm cuối cùng ngay trong đoạn câu hỏi, chỉ giữ phần câu hỏi trước nhãn.
  const clone=el.cloneNode(true);
  const nodes=Array.from(clone.getElementsByTagNameNS('*','t'));
  const cut=m.index;
  let off=0;
  for(const n of nodes){
    const s=n.textContent||'', end=off+s.length;
    if(end<=cut){off=end;continue}
    if(off>=cut)n.textContent='';
    else n.textContent=s.slice(0,Math.max(0,cut-off));
    off=end;
  }
  return clone;
}

export function cloneQuestionForStudent(q,opts,type=''){
  const els=[];let skip=false;
  for(const e of q.els){
    const t=textOf(e).trim();
    if(opts.removeSolutions && type==='essay' && isEssayAnswerStart(t)){
      const cleaned=removeEssayAnswerMarkerFromElement(e);
      if(cleaned && textOf(cleaned).trim()) els.push(cleaned);
      skip=true;
      continue;
    }
    if(opts.removeSolutions&&isSolutionStart(t)){skip=true;continue}
    if(skip)continue;
    if(opts.removeSolutions&&isTLLine(t)){
      const cleaned=removeInlineTLFromElement(e);
      if(textOf(cleaned).trim())els.push(cleaned);
      continue;
    }
    els.push(e.cloneNode(true))
  }
  return {...q,els};
}

export function sanitizeQuestionInPlace(q,type,answer,meta,opts={}){
  if(q.els[0])stripLevelAndLock(q.els[0]);
  for(const el of q.els){
    const ps=el.localName==='p'?[el]:Array.from(el.getElementsByTagNameNS('*','p'));
    ps.forEach(p=>{
      const t=textOf(p);
      let m=t.match(mcqLeadingRegex(q));
      if(m){const isCorrect=answer&&m[1].toUpperCase()===String(answer).toUpperCase();sanitizeLabelParagraph(p,true,isCorrect?(meta&&meta.method||''):'',false)}
      else if((t.match(/(?:^|\s)#?\s*[A-H][\.\)\:]\s*/g)||[]).length>=2)sanitizeInlineMCQParagraph(p,answer,meta&&meta.method||'',false);
      if(type==='tf'){
        m=t.match(/^\s*#?\s*([a-d])[\.\)\:]/);
        if(m){sanitizeLabelParagraph(p,false,'gạch chân nội dung',false);stripExplicitTF(p)}
      }
    });
  }
  return q;
}

export function ensurePPr(p){
  let pPr=Array.from(p.children).find(x=>x.localName==='pPr');
  if(!pPr){pPr=wNode(p.ownerDocument,'pPr');p.insertBefore(pPr,p.firstChild)}
  return pPr;
}

export function removePPrChild(pPr,name){
  Array.from(pPr.children).filter(x=>x.localName===name).forEach(x=>pPr.removeChild(x));
}

export function setOptionParagraphLayout(p,tabPositions=[120,2500,4880,7260]){
  const pPr=ensurePPr(p);
  removePPrChild(pPr,'tabs');removePPrChild(pPr,'ind');removePPrChild(pPr,'spacing');
  // Không dùng khoảng trắng để canh. Mỗi kiểu bố cục dùng đúng các cột cần thiết.
  // Đặc biệt chế độ 2 đáp án/hàng chỉ khai báo cột 1 và cột 3, nên một <w:tab/>
  // sau đáp án thứ nhất luôn nhảy thẳng tới cột 3; không thể vô tình rơi vào cột 4.
  pPr.appendChild(wNode(p.ownerDocument,'ind',{left:'0',right:'0',firstLine:'0'}));
  pPr.appendChild(wNode(p.ownerDocument,'spacing',{before:'0',after:'0',line:'240',lineRule:'auto'}));
  const tabs=wNode(p.ownerDocument,'tabs');
  tabPositions.forEach(pos=>tabs.appendChild(wNode(p.ownerDocument,'tab',{val:'left',pos:String(pos)})));
  pPr.appendChild(tabs);
}

export function appendWordTab(p,count=1){
  for(let i=0;i<count;i++){const r=wNode(p.ownerDocument,'r');r.appendChild(wNode(p.ownerDocument,'tab'));p.appendChild(r)}
}

export function appendParagraphContent(dst,src){
  Array.from(src.childNodes).forEach(n=>{
    if(n.nodeType===1&&n.localName==='pPr')return;
    dst.appendChild(n.cloneNode(true));
  });
}

export function makeOptionRow(doc,optionParas,tabPositions){
  const p=wNode(doc,'p');setOptionParagraphLayout(p,tabPositions);
  // Mỗi phương án chỉ cần đúng 1 tab. Vì paragraph chỉ chứa các tab stop cần dùng,
  // Word/WPS sẽ đưa phương án lần lượt tới đúng cột, không phụ thuộc độ dài đáp án trước.
  optionParas.forEach(op=>{
    appendWordTab(p,1);
    // Các tab cũ trong đáp án Word là dấu canh cột nguồn. Nếu giữ lại,
    // chúng cộng với tab mới, khiến nhãn A–D bị dồn vào giữa/cuối trang.
    // Chỉ bỏ phần tử w:tab, giữ nguyên chữ, hình, OLE/MathType và OMML.
    const clean=op.cloneNode(true);
    Array.from(clean.getElementsByTagNameNS('*','tab')).forEach(tab=>{
      if(tab.namespaceURI==='http://schemas.openxmlformats.org/wordprocessingml/2006/main' && tab.parentNode)tab.parentNode.removeChild(tab);
    });
    appendParagraphContent(p,clean);
  });
  return p;
}

export function optionPlainText(el){
  return textOf(el).replace(/^\s*#?\s*[A-H][\.\)\:]\s*/i,'').replace(/\s+/g,' ').trim();
}

export function optionVisualUnits(el){
  // Trả về bề rộng ước lượng theo POINT, gần với chiều rộng thực trong Word hơn
  // việc đếm ký tự. Font mặc định 12 pt Times New Roman.
  const s=optionPlainText(el);let pt=16; // chừa nhãn “A. ”
  for(const ch of s){
    if(/\s/.test(ch))pt+=3.0;
    else if(/[A-ZĐ0-9]/.test(ch))pt+=6.1;
    else if(/[.,;:!?'"()\[\]{}+\-=×÷°%\/]/.test(ch))pt+=3.2;
    else pt+=5.15;
  }
  // OMML native: lấy mức an toàn nếu không có kích thước trực tiếp.
  const math=el.getElementsByTagNameNS('*','oMath').length+el.getElementsByTagNameNS('*','oMathPara').length;
  if(math)pt+=math*42;
  // MathType/Equation Editor cũ nằm trong w:object/v:shape. Dùng width:...pt thực tế.
  const objects=Array.from(el.getElementsByTagNameNS('*','object'));
  objects.forEach(obj=>{
    const shape=Array.from(obj.getElementsByTagNameNS('*','shape'))[0];
    const style=shape?(shape.getAttribute('style')||''):'';
    const m=style.match(/(?:^|;)\s*width\s*:\s*([0-9.]+)pt/i);
    pt+=m?parseFloat(m[1]):48;
  });
  // Phương án chứa ảnh/drawing nên cho một hàng riêng để tránh co/chồng hình.
  if(el.getElementsByTagNameNS('*','drawing').length||el.getElementsByTagNameNS('*','pict').length)pt=Math.max(pt,999);
  return pt;
}

export function chooseOptionLayout(optionEls,mode){
  if(mode==='4'||mode==='2'||mode==='1'||mode==='keep')return mode;
  const w=optionEls.map(optionVisualUnits),max=Math.max(...w);
  // Với lề A4 2 cm / 1,5 cm, vùng nội dung ~496 pt.
  // 4 cột: ~119 pt/cột; 2 cột: ~238 pt/cột. Chừa biên an toàn cho Word/WPS.
  if(max<=112)return '4';
  if(max<=224)return '2';
  return '1';
}

export function exammixVerifyChoicePreservation(original,generated,originalNumber,newNumber){
  const a=exammixOptionContentList(original),b=exammixOptionContentList(generated);
  if(a.length===4 && b.length!==4)throw new Error(`Phần I · Câu gốc ${originalNumber} → câu ${newNumber}: nhận diện ${b.length}/4 phương án sau trộn (đề gốc có 4). Đã dừng xuất để tránh mất dữ liệu.`);
  if(a.length!==4){
    throw new Error(`Phần I · Câu gốc ${originalNumber}: bộ đọc Word nhận diện ${a.length}/4 phương án A–D. Không thể kiểm chứng bảo toàn nội dung, đã dừng xuất. Hãy kiểm tra nhãn đáp án, Tab hoặc đối tượng Word trong câu này.`);
  }
  const available=b.map(x=>x.content),problems=[];
  a.forEach(x=>{
    const at=available.indexOf(x.content);
    if(at!==-1){available.splice(at,1);return;}
    const lead=b.find(y=>x.content.length>2 && y.content===x.content.slice(1));
    const detail=lead?`mất ký tự đầu “${x.content[0]}” ở phương án ${lead.label}; gốc “${x.content.slice(0,110)}”, sau trộn “${lead.content.slice(0,110)}”`:
      `nội dung phương án gốc ${x.label} bị thay đổi hoặc thiếu: “${x.content.slice(0,140)}”`;
    problems.push(detail);
  });
  if(problems.length)throw new Error(`Phần I · Câu gốc ${originalNumber} → câu ${newNumber}: ${problems.join('; ')}. Đã dừng tạo mã để không xuất đề sai.`);
}

export function exammixNormalizedChoiceText(value){
  return String(value||'').normalize('NFC').replace(/[\s\u00a0]+/g,' ').trim();
}

export function exammixTFContentList(q){
  // Nhận cả A./a), a:, bất kể viết hoa/thường. Chỉ lấy phần chữ, không sửa đối tượng Word.
  const c=canonicalizeDirectOptions(q,false), out=[];
  (c.els||[]).forEach(el=>{
    if(el.localName!=='p')return;
    const raw=textOf(el),m=raw.match(/^\s*#?\s*([a-d])[.\):]\s*/i);
    if(m)out.push({label:m[1].toLowerCase(),content:exammixNormalizedChoiceText(raw.slice(m[0].length))});
  });
  return out;
}

export function exammixVerifyTFPreservation(original,generated,originalNumber,newNumber){
  const before=exammixTFContentList(original),after=exammixTFContentList(generated);
  if(before.length!==4){
    // Không tự suy đoán bốn ý khi đề gốc có cấu trúc phức tạp.
    throw new Error(`Phần II · Câu gốc ${originalNumber}: không thể xác minh đủ 4 ý Đ/S (${before.length}/4). Hãy kiểm tra bố cục nguồn trước khi trộn.`);
  }
  if(after.length!==4)throw new Error(`Phần II · Câu gốc ${originalNumber} → câu ${newNumber}: còn ${after.length}/4 ý Đ/S sau khi trộn. Dừng xuất.`);
  const remaining=after.map(x=>x.content);
  for(const item of before){
    const at=remaining.indexOf(item.content);
    if(at<0){
      throw new Error(`Phần II · Câu gốc ${originalNumber} → câu ${newNumber}: nội dung ý ${item.label}) thay đổi/mất chữ sau trộn (“${item.content.slice(0,120)}”). Dừng xuất.`);
    }
    remaining.splice(at,1);
  }
  if(after.map(x=>x.label).join('')!=='abcd')throw new Error(`Phần II · Câu ${newNumber}: nhãn ý Đ/S không theo a, b, c, d.`);
}

export function exammixQuestionStemText(q,part){
  const paragraphs=(q&&q.els||[]).filter(e=>e.localName==='p');
  const pieces=[];
  for(const p of paragraphs){
    const raw=textOf(p)||'';
    // Ngừng ở đoạn chứa phương án; không biến tên nhân vật "A." ở giữa câu thành nhãn.
    // Phần II: các ý Đ/S có nhãn a), b), c), d) (có thể viết hoa).
    // Không dùng bộ nhận dạng A-D của Phần I: tên người "A." trong câu dẫn
    // và những ý Đ/S bị đảo sẽ gây báo nhầm sai lệch câu dẫn.
    if(Number(part)===2){
      const tf=raw.match(/^\s*#?\s*[a-d][.\):]\s*/i);
      if(tf)break;
    }else{
      const marker=optionMarkersInText(raw,true).find(m=>m.start===0 || /^\s*$/.test(raw.slice(0,m.start)));
      if(marker){if(marker.start>0)pieces.push(raw.slice(0,marker.start));break;}
    }
    // Phần III/IV: TL:/ĐA:/Lời giải: là trường đáp án, không thuộc câu dẫn.
    // Bản học sinh chủ động bỏ đáp án; cần so sánh cùng phạm vi ở cả hai bản.
    if(Number(part)===3 || Number(part)===4){
      const answerStart=raw.search(/(?:^|\s)(?:TL|ĐA|ĐÁP\s*ÁN|DAP\s*AN|Lời\s*giải|Hướng\s*dẫn\s*giải)\s*[:：]/i);
      if(answerStart>=0){
        if(raw.slice(0,answerStart).trim())pieces.push(raw.slice(0,answerStart));
        break;
      }
    }
    pieces.push(raw);
  }
  return pieces.join(' ').replace(/^\s*#?\s*(?:Câu|Bài|Question)\s*\d+\s*[. :：)–-]*\s*/i,'')
    .normalize('NFC').replace(/[\s\u00a0]+/g,' ').trim();
}

export function exammixVerifyStemPreservation(original,generated,oldNo,newNo,part){
  const before=exammixQuestionStemText(original,part),after=exammixQuestionStemText(generated,part);
  // Không tuyên bố đạt nếu bộ nhận diện không xác định được câu dẫn.
  if(!before || !after)return;
  if(before===after)return;
  let k=0;while(k<before.length&&k<after.length&&before[k]===after[k])k++;
  const context=s=>s.slice(Math.max(0,k-22),Math.min(s.length,k+65));
  throw new Error(`Phần ${part} · Câu gốc ${oldNo} → câu ${newNo}: câu dẫn thay đổi ở vị trí ký tự ${k+1}. Gốc: “${context(before)}”; sau trộn: “${context(after)}”. Đã dừng xuất để tránh sai dữ kiện.`);
}

export function exammixAuditOutputObjects(sourceQ,generatedQ,part,oldNo,newNo){
  const a=countQuestionObjects(sourceQ),b=countQuestionObjects(generatedQ);
  if(a!==b)throw new Error(`Phần ${part} · Câu gốc ${oldNo} → câu ${newNo}: số đối tượng Equation/MathType/hình thay đổi (${a} → ${b}). Dừng xuất.`);
}

export function assertMCQIntegrity(q,questionNo,expectedObjects=null){
  const labs=mcqLabelsAnywhere(q);
  if(labs.length!==4||labs.join('')!=='ABCD'){
    throw new Error(`Câu ${questionNo}: lỗi nhãn phương án sau khi trộn (${labs.join('/')||'không nhận được'}). Chương trình đã DỪNG để không xuất đề lỗi.`);
  }
  if(expectedObjects!==null){
    const got=countQuestionObjects(q);
    if(got!==expectedObjects){
      throw new Error(`Câu ${questionNo}: số công thức/hình thay đổi khi trộn (${expectedObjects} → ${got}). Chương trình đã DỪNG để tránh mất dữ liệu.`);
    }
  }
}

export function formatMCQOptionsTabs(q,mode='auto'){
  const pos=directLabelPositions(q,mcqLeadingRegex(q)).filter(x=>/[A-D]/.test(x.label)).sort((a,b)=>a.i-b.i);
  if(pos.length!==4||pos.map(x=>x.label.toUpperCase()).join('')!=='ABCD')return q;
  // Cho phép các đoạn trống xen giữa các phương án; Word gốc thường chứa
  // đoạn ngắt hàng rỗng. Không nuốt đoạn có hình/công thức hoặc nội dung.
  for(let k=1;k<pos.length;k++){
    for(let j=pos[k-1].i+1;j<pos[k].i;j++){
      const gap=q.els[j];
      if(textOf(gap).trim() || countQuestionObjects({els:[gap]})>0)return q;
    }
  }
  if(pos.some(x=>x.el.localName!=='p'))return q;
  const before=q.els.slice(0,pos[0].i),after=q.els.slice(pos[3].i+1);
  let rows=[];

  // HeaderSafe: ở chế độ "Giữ định dạng đề gốc", canonicalize đã tách A-D nội bộ
  // để trộn an toàn. Tại đây ghép lại đúng số phương án trên từng hàng của đề gốc.
  if(mode==='keep'){
    const spec=Array.isArray(q.sourceOptionRows)?q.sourceOptionRows.filter(n=>n>0):[];
    if(spec.length && spec.reduce((a,b)=>a+b,0)===4){
      let k=0;
      spec.forEach(n=>{
        const ops=pos.slice(k,k+n).map(x=>x.el);k+=n;
        const tabs=n>=4?[120,2500,4880,7260]:n===3?[120,3300,6500]:n===2?[120,4880]:[120];
        rows.push(makeOptionRow(q.els[0].ownerDocument,ops,tabs));
      });
      return {...q,els:[...before,...rows,...after],optionLayout:'source'};
    }
    return q;
  }

  const layout=chooseOptionLayout(pos.map(x=>x.el),mode);
  if(layout==='4'){
    rows=[makeOptionRow(q.els[0].ownerDocument,pos.map(x=>x.el),[120,2500,4880,7260])];
  }else if(layout==='2'){
    rows=[
      makeOptionRow(q.els[0].ownerDocument,[pos[0].el,pos[1].el],[120,4880]),
      makeOptionRow(q.els[0].ownerDocument,[pos[2].el,pos[3].el],[120,4880])
    ];
  }else{
    rows=pos.map(x=>makeOptionRow(q.els[0].ownerDocument,[x.el],[120]));
  }
  return {...q,els:[...before,...rows,...after],optionLayout:layout};
}

export function shuffleRespectFixed(arr){const out=[...arr],idx=arr.map((q,i)=>q.fixed?null:i).filter(x=>x!==null),vals=shuffle(idx.map(i=>arr[i]));idx.forEach((i,j)=>out[i]=vals[j]);return out}

export function shuffleByGroupsFixed(arr,groups){if(!groups.length)return shuffleRespectFixed(arr);const out=[];let idx=0;for(const g of groups){out.push(...shuffleRespectFixed(arr.slice(idx,idx+g)));idx+=g}if(idx<arr.length)out.push(...shuffleRespectFixed(arr.slice(idx)));return out}

export function shuffleByLevels(arr){
  const out=[...arr],groups={};arr.forEach((q,i)=>{if(q.fixed)return;const k=q.level||'_';(groups[k]||(groups[k]=[])).push(i)});Object.values(groups).forEach(idxs=>{const vals=shuffle(idxs.map(i=>arr[i]));idxs.forEach((i,j)=>out[i]=vals[j])});return out;
}

export function orderSectionQuestions(sec,si,opts,groups,firstQSec){
  // Đề Tiếng Anh: tuyệt đối không trộn câu qua biên khối passage/cloze/arrangement.
  if(sec.englishMode && Array.isArray(sec.englishBlocks) && sec.englishBlocks.length){
    const out=[];
    sec.englishBlocks.forEach(block=>{
      let items=block.questions.map(q=>({...q,fixed:false}));
      if(block.shuffleQuestions!==false) items=shuffleRespectFixed(items);
      items.forEach((q,i)=>out.push({...q,
        englishPrefix:i===0?(block.prefix||[]):[],
        englishBlockKind:block.kind||'standalone',
        englishBlockId:block.id
      }));
    });
    return out;
  }
  const partNo=sectionPartNo(sec);
  const qs=sec.questions.map(q=>({...q,fixed:false}));
  if(partNo===4 && !opts.shuffleEssay) return qs;
  const clusterOrder=exClusterOrder(qs,opts);
  if(clusterOrder)return clusterOrder;
  const hasExplicit=qs.some(q=>q.groupMode!==null&&q.groupMode!==undefined);
  if(hasExplicit){
    const blocks=[];let cur=null;
    qs.forEach(q=>{const key=q.groupId||0;if(!cur||cur.key!==key){cur={key,mode:q.groupMode,items:[]};blocks.push(cur)}cur.items.push(q)});
    return blocks.flatMap(b=>{
      if(b.mode===1||b.mode===3){if(opts.autoLevelGroups&&b.items.some(q=>q.level))return shuffleByLevels(b.items);return shuffleRespectFixed(b.items)}
      return b.items;
    });
  }
  if(opts.autoLevelGroups&&qs.some(q=>q.level))return shuffleByLevels(qs);
  if(si===firstQSec&&groups.length)return shuffleByGroupsFixed(qs,groups);
  return shuffleRespectFixed(qs);
}

export function centerImageParagraphs(body){Array.from(body.getElementsByTagNameNS(W_NS,'p')).forEach(p=>{const has=p.getElementsByTagNameNS('*','drawing').length||p.getElementsByTagNameNS('*','pict').length;if(!has)return;let pPr=Array.from(p.children).find(x=>x.localName==='pPr');if(!pPr){pPr=wNode(p.ownerDocument,'pPr');p.insertBefore(pPr,p.firstChild)}let jc=Array.from(pPr.children).find(x=>x.localName==='jc');if(!jc){jc=wNode(p.ownerDocument,'jc');pPr.appendChild(jc)}jc.setAttributeNS(W_NS,'w:val','center')})}

export function normalizeDocumentRuns(body){
  Array.from(body.getElementsByTagNameNS('*','r')).forEach(r=>{if(r.namespaceURI!==W_NS)return;let rp=Array.from(r.children).find(x=>x.localName==='rPr');if(!rp){rp=wNode(r.ownerDocument,'rPr');r.insertBefore(rp,r.firstChild)}let rf=Array.from(rp.children).find(x=>x.localName==='rFonts');if(!rf){rf=wNode(r.ownerDocument,'rFonts');rp.appendChild(rf)}['ascii','hAnsi','eastAsia'].forEach(k=>rf.setAttributeNS(W_NS,'w:'+k,'Times New Roman'));removeChildProp(rp,'color');rp.appendChild(wNode(r.ownerDocument,'color',{val:'000000'}));let sz=Array.from(rp.children).find(x=>x.localName==='sz');if(!sz){sz=wNode(r.ownerDocument,'sz');rp.appendChild(sz)}sz.setAttributeNS(W_NS,'w:val','24')});
}

export function normalizeParagraphSpacing(body){
  Array.from(body.getElementsByTagNameNS(W_NS,'p')).forEach(p=>{
    let pPr=Array.from(p.children).find(x=>x.localName==='pPr');
    if(!pPr){pPr=wNode(p.ownerDocument,'pPr');p.insertBefore(pPr,p.firstChild)}
    // Xóa spacing cũ và contextualSpacing để Word/WPS không tự thêm khoảng cách.
    Array.from(pPr.children).filter(x=>x.localName==='spacing'||x.localName==='contextualSpacing').forEach(x=>pPr.removeChild(x));
    pPr.appendChild(wNode(p.ownerDocument,'spacing',{
      before:'0',
      after:'0',
      line:'240',
      lineRule:'auto'
    }));
  });
}

export function removeStandardBlankParagraphs(body){
  // Đề chuẩn không giữ các paragraph rỗng dùng để "cách câu" thủ công trong đề gốc.
  // Chỉ bỏ đoạn thật sự rỗng; bảo vệ ảnh, Equation, MathType, page break và các đối tượng Word khác.
  Array.from(body.getElementsByTagNameNS(W_NS,'p')).forEach(p=>{
    const visible=textOf(p).replace(/[\s\u00A0]+/g,'');
    const protectedContent=
      p.getElementsByTagNameNS('*','drawing').length||
      p.getElementsByTagNameNS('*','pict').length||
      p.getElementsByTagNameNS('*','object').length||
      p.getElementsByTagNameNS('*','oMath').length||
      p.getElementsByTagNameNS('*','oMathPara').length||
      p.getElementsByTagNameNS('*','br').length;
    if(!visible && !protectedContent && p.parentNode===body) body.removeChild(p);
  });
}

export function standardizeExamSpacing(body){
  removeStandardBlankParagraphs(body);
  Array.from(body.getElementsByTagNameNS(W_NS,'p')).forEach(p=>{
    let pPr=Array.from(p.children).find(x=>x.localName==='pPr');
    if(!pPr){pPr=wNode(p.ownerDocument,'pPr');p.insertBefore(pPr,p.firstChild)}
    Array.from(pPr.children).filter(x=>x.localName==='spacing'||x.localName==='contextualSpacing').forEach(x=>pPr.removeChild(x));
    const t=textOf(p).trim();
    let before='0',after='0';
    // Phần lớn đề thi chính thức không chèn một dòng trắng giữa hai câu.
    // Chỉ tạo một khoảng nhỏ 2 pt trước câu mới để dễ đọc.
    if(isPartHeading(t)){before='80';after='20'}       // 4 pt / 1 pt
    else if(/^(?:Câu|Bài|Question)\s*\d+/i.test(t)){before='40';after='0'}; // 2 pt
    pPr.appendChild(wNode(p.ownerDocument,'spacing',{before,after,line:'240',lineRule:'auto'}));
  });
}

export function standardizeExamParagraphLayout(body){
  // SmartLayout: ở chế độ Tạo đề chuẩn, tuyệt đối không kế thừa thụt lề/căn giữa/list
  // bất thường từ đề nguồn. Chỉ giữ tabs do ExamMix tự dựng cho đáp án và giữ riêng
  // các paragraph chỉ chứa ảnh/công thức độc lập.
  let inExamBody=false;
  Array.from(body.children).forEach(node=>{
    if(node.localName!=='p') return;
    const t=textOf(node).replace(/[\s\u00A0]+/g,' ').trim();
    if(isPartHeading(t)) inExamBody=true;
    if(!inExamBody) return; // không động vào khối tiêu đề hành chính phía trên PHẦN I

    let pPr=Array.from(node.children).find(x=>x.localName==='pPr');
    if(!pPr){pPr=wNode(node.ownerDocument,'pPr');node.insertBefore(pPr,node.firstChild)}

    // Xóa toàn bộ thụt lề của nguồn và đặt về mép chuẩn.
    Array.from(pPr.children).filter(x=>x.localName==='ind').forEach(x=>pPr.removeChild(x));
    pPr.appendChild(wNode(node.ownerDocument,'ind',{left:'0',right:'0',firstLine:'0'}));

    // Loại numbering/list của nguồn vì dễ kéo câu vào trong hoặc sinh bullet ngoài ý muốn.
    Array.from(pPr.children).filter(x=>x.localName==='numPr').forEach(x=>pPr.removeChild(x));

    const hasObject=
      node.getElementsByTagNameNS('*','drawing').length||
      node.getElementsByTagNameNS('*','pict').length||
      node.getElementsByTagNameNS('*','object').length||
      node.getElementsByTagNameNS('*','oMath').length||
      node.getElementsByTagNameNS('*','oMathPara').length;

    // Paragraph chỉ có ảnh/công thức riêng thì để centerImageParagraphs/Word giữ bố cục phù hợp.
    // Paragraph có chữ (kể cả chữ + MathType inline) luôn căn trái theo chuẩn đề thi.
    const endMark=/^(?:—|--)?\s*HẾT\s*(?:—|--)?$/i.test(t);
    if(t){
      Array.from(pPr.children).filter(x=>x.localName==='jc').forEach(x=>pPr.removeChild(x));
      pPr.appendChild(wNode(node.ownerDocument,'jc',{val:endMark?'center':'left'}));
    }else if(!hasObject){
      Array.from(pPr.children).filter(x=>x.localName==='jc').forEach(x=>pPr.removeChild(x));
      pPr.appendChild(wNode(node.ownerDocument,'jc',{val:'left'}));
    }
  });
}

export function smartCleanLeadingWhitespaceInParagraph(p){
  if(!p) return;
  // Loại khoảng trắng/NBSP được gõ trực tiếp ở đầu paragraph qua nhiều w:t.
  // Không đụng vào nội dung phía sau nhãn, MathType/Equation hay tabs bố trí đáp án.
  const texts=Array.from(p.getElementsByTagNameNS('*','t'));
  let stillLeading=true;
  for(const t of texts){
    if(!stillLeading) break;
    const s=t.textContent||'';
    if(!s) continue;
    const cleaned=s.replace(/^[\s\u00A0]+/,'');
    if(cleaned!==s) t.textContent=cleaned;
    if(cleaned.length) stillLeading=false;
  }
  // Xóa các w:tab nằm ở đầu paragraph nếu có. Chỉ áp dụng cho paragraph đã xác định
  // là Câu... hoặc tiểu ý a)-d), nên không ảnh hưởng Smart Tabs của phương án A-D.
  let reachedContent=false;
  for(const child of Array.from(p.childNodes)){
    if(child.nodeType!==1) continue;
    if(child.localName==='pPr') continue;
    if(reachedContent) break;
    const local=child.localName;
    if(local==='r'){
      const text=Array.from(child.getElementsByTagNameNS('*','t')).map(x=>x.textContent||'').join('');
      const hasObject=child.getElementsByTagNameNS('*','drawing').length||child.getElementsByTagNameNS('*','pict').length||child.getElementsByTagNameNS('*','object').length||child.getElementsByTagNameNS('*','oMath').length||child.getElementsByTagNameNS('*','oMathPara').length;
      if(!text.trim()&&!hasObject){
        Array.from(child.getElementsByTagNameNS('*','tab')).forEach(x=>x.parentNode&&x.parentNode.removeChild(x));
        const residual=Array.from(child.getElementsByTagNameNS('*','t')).map(x=>x.textContent||'').join('');
        if(!residual.trim()&&!hasObject&&child.parentNode===p) p.removeChild(child);
        continue;
      }
      Array.from(child.getElementsByTagNameNS('*','tab')).forEach(x=>x.parentNode&&x.parentNode.removeChild(x));
      reachedContent=true;
    }else{
      reachedContent=true;
    }
  }
}

export function cleanQuestionStartsAllModes(body){
  Array.from(body.getElementsByTagNameNS(W_NS,'p')).forEach(p=>{
    const raw=textOf(p)||'';
    const trimmed=raw.replace(/^[\s\u00A0]+/,'');
    if(/^(?:Câu|Bài|Question)\s*\d+\s*[\.\:\)]/i.test(trimmed)) smartCleanLeadingWhitespaceInParagraph(p);
  });
}

export function setWordKeepFlag(p,name,on=true){
  if(!p||p.localName!=='p')return;
  let pPr=Array.from(p.children).find(x=>x.localName==='pPr');
  if(!pPr){pPr=wNode(p.ownerDocument,'pPr');p.insertBefore(pPr,p.firstChild)}
  Array.from(pPr.children).filter(x=>x.localName===name).forEach(x=>pPr.removeChild(x));
  if(on)pPr.appendChild(wNode(p.ownerDocument,name));
}

export function protectQuestionBlockPagination(q){
  const top=(q.els||[]).filter(x=>x&&x.localName==='p');
  top.forEach((p,i)=>{
    // English source may contain long answers and long reading paragraphs.
    // Do not chain every paragraph: that forces Word to move a whole question to the next page.
    setWordKeepFlag(p,'keepLines',true);
    setWordKeepFlag(p,'keepNext',i===0 && top.length>1);
  });
  return q;
}

export function protectPartHeadingPagination(body){
  Array.from(body.children||[]).forEach(n=>{
    if(n.localName!=='p')return;
    const t=(textOf(n)||'').replace(/[\s\u00A0]+/g,' ').trim();
    if(isPartHeading(t)){
      setWordKeepFlag(n,'keepLines',true);
      setWordKeepFlag(n,'keepNext',true);
    }
  });
}

export function smartCleanExamBody(body){
  // SmartClean v8.1.4: đề gốc có thể chứa space/tab thủ công ở đầu câu.
  // Ở chế độ Tạo đề chuẩn, mọi câu và tiểu ý phải bắt đầu đúng mép trái.
  const ps=Array.from(body.getElementsByTagNameNS(W_NS,'p'));
  ps.forEach(p=>{
    const raw=textOf(p);
    const trimmed=raw.replace(/^[\s\u00A0]+/,'');
    const isQuestion=/^(?:Câu|Bài|Question)\s*\d+\s*[\.\:\)]/i.test(trimmed);
    const isSubItem=/^[a-d]\s*\)/i.test(trimmed);
    if(isQuestion||isSubItem) smartCleanLeadingWhitespaceInParagraph(p);
  });
}

export function canonicalizeStandardExamParagraphs(body){
  // CanonicalLayout v8.1.5: ở chế độ Tạo đề chuẩn, không kế thừa pStyle/tab/indent
  // của nguồn cho câu hỏi và tiểu ý. Đây là lớp làm sạch mạnh hơn SmartClean v8.1.4.
  const ps=Array.from(body.getElementsByTagNameNS(W_NS,'p'));
  let started=false;
  for(const p of ps){
    const raw=textOf(p)||'';
    const clean=raw.replace(/^[\s\u00A0]+/,'').replace(/[\s\u00A0]+/g,' ').trim();
    if(isPartHeading(clean)) started=true;
    if(!started) continue;

    const isQuestion=/^Câu\s*\d+\s*[\.\:\)]/i.test(clean);
    const isSubItem=/^[a-d]\s*\)/i.test(clean);
    const isPart=isPartHeading(clean);
    const isEnd=/^(?:—|--)?\s*HẾT\s*(?:—|--)?$/i.test(clean);
    if(!(isQuestion||isSubItem||isPart||isEnd)) continue;

    smartCleanLeadingWhitespaceInParagraph(p);

    let pPr=Array.from(p.children).find(x=>x.localName==='pPr');
    if(!pPr){pPr=wNode(p.ownerDocument,'pPr');p.insertBefore(pPr,p.firstChild)}

    // Bỏ hoàn toàn style/list/tabs/indent/căn lề nguồn có thể kéo dòng sang phải.
    const kill=new Set(['pStyle','ind','jc','numPr','tabs','framePr','mirrorIndents','textDirection','outlineLvl']);
    Array.from(pPr.children).forEach(x=>{if(kill.has(x.localName))pPr.removeChild(x)});

    // Với câu hỏi và tiểu ý: xóa mọi tab/br/cr nằm trước hoặc trong nhãn đầu dòng.
    // Câu hỏi chuẩn không cần tab; A-D được xử lý ở paragraph đáp án riêng.
    if(isQuestion||isSubItem){
      Array.from(p.getElementsByTagNameNS('*','tab')).forEach(x=>x.parentNode&&x.parentNode.removeChild(x));
      // Xóa break đầu đoạn nếu đề nguồn chèn thủ công.
      let seenVisible=false;
      for(const r of Array.from(p.children).filter(x=>x.localName==='r')){
        const txt=Array.from(r.getElementsByTagNameNS('*','t')).map(x=>x.textContent||'').join('');
        const obj=r.getElementsByTagNameNS('*','drawing').length||r.getElementsByTagNameNS('*','pict').length||r.getElementsByTagNameNS('*','object').length||r.getElementsByTagNameNS('*','oMath').length||r.getElementsByTagNameNS('*','oMathPara').length;
        if(!seenVisible && !txt.trim() && !obj){
          Array.from(r.getElementsByTagNameNS('*','br')).forEach(x=>x.parentNode&&x.parentNode.removeChild(x));
          Array.from(r.getElementsByTagNameNS('*','cr')).forEach(x=>x.parentNode&&x.parentNode.removeChild(x));
        }
        if(txt.trim()||obj) seenVisible=true;
      }
    }

    // Dựng pPr chuẩn hoàn toàn.
    pPr.appendChild(wNode(p.ownerDocument,'ind',{left:'0',right:'0',firstLine:'0',hanging:'0'}));
    pPr.appendChild(wNode(p.ownerDocument,'jc',{val:isEnd?'center':'left'}));
    if(isQuestion||isSubItem){
      pPr.appendChild(wNode(p.ownerDocument,'spacing',{before:'0',after:'0',line:'240',lineRule:'auto'}));
    }
  }
}

export function assertCanonicalStandardExam(body){
  const bad=[];
  const ps=Array.from(body.getElementsByTagNameNS(W_NS,'p'));
  let started=false;
  for(const p of ps){
    const raw=textOf(p)||'';
    const clean=raw.replace(/^[\s\u00A0]+/,'').replace(/[\s\u00A0]+/g,' ').trim();
    if(isPartHeading(clean)) started=true;
    if(!started) continue;
    if(!(/^Câu\s*\d+\s*[\.\:\)]/i.test(clean)||/^[a-d]\s*\)/i.test(clean))) continue;
    const pPr=Array.from(p.children).find(x=>x.localName==='pPr');
    const pStyle=pPr&&Array.from(pPr.children).find(x=>x.localName==='pStyle');
    const numPr=pPr&&Array.from(pPr.children).find(x=>x.localName==='numPr');
    const tabs=p.getElementsByTagNameNS('*','tab').length;
    const ind=pPr&&Array.from(pPr.children).find(x=>x.localName==='ind');
    const left=ind?(ind.getAttributeNS(W_NS,'left')||ind.getAttribute('w:left')||ind.getAttribute('left')||'0'):'0';
    const first=ind?(ind.getAttributeNS(W_NS,'firstLine')||ind.getAttribute('w:firstLine')||ind.getAttribute('firstLine')||'0'):'0';
    if(/^[\s\u00A0]+/.test(raw)||pStyle||numPr||tabs||String(left)!=='0'||String(first)!=='0') bad.push(clean.slice(0,70));
  }
  if(bad.length) throw new Error('CanonicalLayout còn phát hiện '+bad.length+' dòng câu/ý chưa về chuẩn: '+bad.slice(0,3).join(' | '));
}

export function assertSmartCleanExamBody(body){
  const bad=[];
  Array.from(body.getElementsByTagNameNS(W_NS,'p')).forEach(p=>{
    const raw=textOf(p);
    const trimmed=raw.replace(/^[\s\u00A0]+/,'');
    if((/^Câu\s*\d+\s*[\.\:\)]/i.test(trimmed)||/^[a-d]\s*\)/i.test(trimmed)) && /^[\s\u00A0]+/.test(raw)){
      bad.push(trimmed.slice(0,60));
    }
  });
  if(bad.length) throw new Error('SmartClean chưa làm sạch khoảng trắng đầu dòng ở '+bad.length+' mục: '+bad.slice(0,3).join(' | '));
}

export function bodyTopLevelNodesBeforeFirstPart(body){
  const out=[];
  for(const n of Array.from(body.children)){
    if(n.localName==='sectPr') break;
    const t=textOf(n).trim();
    if(isPartHeading(t)) break;
    out.push(n);
  }
  return out;
}

export function nodeHasVisibleHeaderContent(n){
  if(!n) return false;
  const t=textOf(n).replace(/[\s\u00A0]+/g,' ').trim();
  if(t && !/^MÃ\s*ĐỀ\s*[:：]?\s*\d*$/i.test(t)) return true;
  return !!(n.getElementsByTagNameNS('*','drawing').length||n.getElementsByTagNameNS('*','pict').length||n.getElementsByTagNameNS('*','tbl').length);
}

export function hasMeaningfulSourceHeader(body){
  return bodyTopLevelNodesBeforeFirstPart(body).some(nodeHasVisibleHeaderContent);
}

export function removeNodesBeforeFirstPart(body){
  bodyTopLevelNodesBeforeFirstPart(body).forEach(n=>{if(n.parentNode===body)body.removeChild(n)});
}

export function insertHeaderBeforeFirstPart(body,nodes){
  const firstPart=Array.from(body.children).find(n=>isPartHeading(textOf(n).trim()))||Array.from(body.children).find(n=>n.localName==='sectPr')||null;
  nodes.forEach(n=>body.insertBefore(n,firstPart));
}

export function applyExamHeaderPolicy(body,doc,opts,headerInfo){
  const hasSourceHeader=hasMeaningfulSourceHeader(body);
  const wantInjected=!!opts.injectHeader;
  const wantReplace=!!opts.removeOldHeader && opts.outputStyle==='standard';

  // Nếu đề đã có tiêu đề: giữ nguyên ở chế độ bảo toàn; ở chế độ chuẩn cũng giữ
  // trừ khi giáo viên chủ động chọn "Thay tiêu đề gốc...".
  if(hasSourceHeader && !(wantInjected && wantReplace)) return {hasSourceHeader:true,injected:false,replaced:false};

  // Nếu cần thay hoặc đề hoàn toàn chưa có tiêu đề thì tạo tiêu đề từ cấu hình.
  if(wantInjected && (wantReplace || !hasSourceHeader)){
    removeNodesBeforeFirstPart(body);
    insertHeaderBeforeFirstPart(body,buildExamHeaderNodes(doc,headerInfo||{}));
    return {hasSourceHeader:hasSourceHeader,injected:true,replaced:hasSourceHeader};
  }
  return {hasSourceHeader:hasSourceHeader,injected:false,replaced:false};
}

export function normalizeQuestionLabelPunctuation(el){
  if(!el) return;
  const full=textOf(el);
  const m=full.match(/^(\s*(?:Câu|Bài|Question)\s*\d+)\s+([\.\:\)])/i);
  if(!m) return;
  const prefixLen=m[1].length;
  const punctIndex=full.indexOf(m[2],prefixLen);
  if(punctIndex<0) return;
  // Xóa riêng khoảng trắng giữa số câu và dấu câu, kể cả khi Word chia qua nhiều run.
  let off=0;
  Array.from(el.getElementsByTagNameNS('*','t')).forEach(t=>{
    const s=t.textContent||'', start=off, end=off+s.length;
    const a=Math.max(start,prefixLen), b=Math.min(end,punctIndex);
    if(a<b){
      const la=a-start, lb=b-start;
      t.textContent=s.slice(0,la)+s.slice(lb);
    }
    off=end;
  });
}

export function replaceTextSpanAcrossNodes(el,start,end,newText){
  const nodes=Array.from(el.getElementsByTagNameNS('*','t'));
  let off=0,inserted=false;
  nodes.forEach(t=>{
    const s=t.textContent||'', a=off, b=off+s.length;
    if(end<=a||start>=b){off=b;return;}
    const l=Math.max(0,start-a), r=Math.min(s.length,end-a);
    const add=!inserted?newText:'';
    t.textContent=s.slice(0,l)+add+s.slice(r);
    inserted=true;
    off=b;
  });
  return inserted;
}

export function normalizeExamLabelPunctuationInBody(body){
  Array.from(body.getElementsByTagNameNS(W_NS,'p')).forEach(p=>{
    // Làm nhiều vòng vì một paragraph có thể chứa 4 đáp án trên cùng hàng.
    for(let guard=0;guard<12;guard++){
      const full=textOf(p);
      const m=full.match(/^(\s*Câu\s*\d+)\s+([\.\:\)])/i);
      if(m){
        const s=m[1].length, e=full.indexOf(m[2],s);
        if(e>s){replaceTextSpanAcrossNodes(p,s,e,'');continue;}
      }
      // A . / B . / C . / D . hoặc a ) ... -> A. / a)
      const re=/(^|[\s\u00A0])([A-Da-d])\s+([\.\)\:])/g;
      let hit=null,x;
      while((x=re.exec(full))){hit=x;} // lấy match cuối để offset phía trước không bị thay đổi
      if(hit){
        const labelStart=hit.index+(hit[1]||'').length;
        const wsStart=labelStart+1;
        const punctPos=full.indexOf(hit[3],wsStart);
        if(punctPos>wsStart){replaceTextSpanAcrossNodes(p,wsStart,punctPos,'');continue;}
      }
      break;
    }
  });
}

export function ensureVariantCode(body,code,standard=false){
  const ps=Array.from(body.getElementsByTagNameNS(W_NS,'p'));
  const part=ps.find(p=>isPartHeading(textOf(p).trim()));
  const existing=ps.find(p=>/MÃ\s*ĐỀ\s*[:：]?/i.test(textOf(p)));
  if(existing){
    const full=textOf(existing);
    const mm=full.match(/MÃ\s*ĐỀ\s*[:：]?\s*(\d+)/i);
    if(mm){
      if(String(mm[1])===String(code)) return; // đã đúng, tuyệt đối không nối thêm mã lần hai
      const ds=full.indexOf(mm[1],mm.index);
      if(ds>=0 && replaceTextSpanAcrossNodes(existing,ds,ds+mm[1].length,String(code))) return;
    }
    if(code){
      // Có nhãn MÃ ĐỀ nhưng chưa có số: chỉ thêm một lần.
      existing.appendChild(makeWRun(existing.ownerDocument,String(code),{bold:true,size:22}));
    }
    return;
  }
  if(!code)return;
  const anchor=part||ps.find(p=>isEnglishBlockIntro(textOf(p).trim()))||ps.find(p=>isQuestionStart(textOf(p).trim()));
  if(!anchor)return;
  const p=makeWParagraph(body.ownerDocument,`MÃ ĐỀ: ${code}`,{align:'right',bold:!!standard,size:standard?24:22,before:0,after:0,line:240});
  anchor.parentNode.insertBefore(p,anchor);
}

export function standardizePage(sectPr){
  if(!sectPr)return;
  let mar=Array.from(sectPr.children).find(x=>x.localName==='pgMar');
  if(!mar){mar=wNode(sectPr.ownerDocument,'pgMar');sectPr.appendChild(mar)}
  // 1 cm ≈ 567 twips
  mar.setAttributeNS(W_NS,'w:top','1134');    // 2 cm
  mar.setAttributeNS(W_NS,'w:bottom','1134'); // 2 cm
  mar.setAttributeNS(W_NS,'w:left','1134');   // 2 cm
  mar.setAttributeNS(W_NS,'w:right','851');   // 1.5 cm
  let sz=Array.from(sectPr.children).find(x=>x.localName==='pgSz');
  if(!sz){sz=wNode(sectPr.ownerDocument,'pgSz');sectPr.appendChild(sz)}
  sz.setAttributeNS(W_NS,'w:w','11906');
  sz.setAttributeNS(W_NS,'w:h','16838');
}

export function exammixEnforceOutputBodyFont(body,halfPoints){
  if(!halfPoints)return 0;
  const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const get=(n,name)=>n&&Array.from(n.children).find(x=>x.namespaceURI===W&&x.localName===name);
  const doc=body.ownerDocument;
  let active=false, count=0;
  for(const p of Array.from(body.getElementsByTagNameNS(W,'p'))){
    const t=textOf(p).trim();
    if(/^PHẦN\s+(I|II|III|IV)\b/i.test(t)){active=true;continue;}
    if(!active)continue;
    if(/^(?:—\s*)?HẾT(?:\s*—)?$/i.test(t))break;
    for(const run of Array.from(p.getElementsByTagNameNS(W,'r'))){
      if(!run.getElementsByTagNameNS(W,'t').length)continue;
      if(['drawing','object','pict'].some(z=>run.getElementsByTagNameNS(W,z).length))continue;
      if(run.getElementsByTagNameNS('http://schemas.openxmlformats.org/officeDocument/2006/math','oMath').length)continue;
      let rPr=get(run,'rPr');if(!rPr){rPr=doc.createElementNS(W,'w:rPr');run.insertBefore(rPr,run.firstChild);}
      for(const label of ['sz','szCs']){
        let z=get(rPr,label);if(!z){z=doc.createElementNS(W,'w:'+label);rPr.appendChild(z);}
        z.setAttributeNS(W,'w:val',String(halfPoints));
      }
      count++;
    }
  }
  return count;
}

export function buildVariant(xml,opts,analysis,headerInfo={}){
  const doc=new DOMParser().parseFromString(xml,'application/xml'),body=doc.getElementsByTagNameNS('*','body')[0];if(!body)throw new Error('Không tìm thấy body Word.');const parsed=splitDocumentSmart(body,opts.englishBlockMode!==false);if(!parsed.total)throw new Error('Không nhận diện được câu hỏi.');
  const groups=parseGroupSizes(opts.groupSizes),matrixRows=[],resultSections=[],essayItems=[];const answers={mcq:[],tf:[],short:[],essay:[]};const firstQSec=parsed.sections.findIndex(s=>s.questions.length);
  parsed.sections.forEach((sec,si)=>{
    const partNo=sectionPartNo(sec);
    let qs=orderSectionQuestions(sec,si,opts,groups,firstQSec);
    if(opts.em217SelectedIds && sec.englishMode && opts.em217SelectedIds.size!==sec.questions.length){
      throw new Error('Chọn lọc một phần đề tiếng Anh có ngữ liệu dùng chung chưa được bảo đảm. Hãy trộn toàn bộ đề để giữ đúng Questions và số thứ tự chỗ trống.');
    }
    if(opts.em217SelectedIds && sec.englishMode && Array.isArray(sec.englishBlocks)){
      for(const block of sec.englishBlocks){
        const picked=block.questions.filter(q=>opts.em217SelectedIds.has(q.originalIndex)).length;
        if(picked>0 && picked<block.questions.length)throw new Error('Bài tiếng Anh Questions '+block.firstNum+'–'+block.lastNum+': cần chọn toàn bộ câu thuộc cùng ngữ liệu, không chọn lẻ.');
        if(picked>0 && block.firstNum!==block.questions[0].originalIndex+1)throw new Error('Đề tiếng Anh có nhóm câu đánh số không liên tục. Chưa thể lọc an toàn.');
      }
    }
    if(opts.em217SelectedIds)qs=qs.filter(q=>opts.em217SelectedIds.has(q.originalIndex));
    const firstNum=opts.em217SelectedIds?1:(sec.questions.length?(sec.questions[0].originalNum||1):1);const outQs=[];
    qs.forEach((q,j)=>{
      const meta=analysis.byOriginalIndex[q.originalIndex]||{type:detectQuestionType(q,sec),answer:''};
      const sourceObjectCount=meta.type==='mcq'?countQuestionObjects(q):null;
      const sourceQ=meta.type==='mcq'?canonicalizeDirectOptions(q,true):meta.type==='tf'?canonicalizeDirectOptions(q,false):q;
      if(meta.type==='mcq' && countQuestionObjects(sourceQ)!==sourceObjectCount){
        throw new Error(`Câu ${q.originalNum||q.originalIndex+1}: mất công thức/hình trong bước chuẩn hóa đáp án. Đã dừng xuất để bảo vệ đề gốc.`);
      }
      const newNo=firstNum+j;
      if(meta.type==='essay') essayItems.push({question:cloneEssayQuestionForAnswer(q,newNo),missing:!meta.answer});
      let qq=cloneQuestionForStudent(sourceQ,opts,meta.type),ans=meta.answer||'';
      const choiceShuffle=q.groupMode===null||q.groupMode===undefined?opts.shuffleChoices:(q.groupMode===2||q.groupMode===3);
      const tfShuffle=q.groupMode===null||q.groupMode===undefined?!opts.dontShuffleTF:(q.groupMode===2||q.groupMode===3);
      if(meta.type==='mcq'&&choiceShuffle){const r=shuffleChoicesPro(qq,ans,opts);qq=r.question;ans=r.newAnswer}
      if(meta.type==='tf'&&tfShuffle){const r=shuffleTFPro(qq,ans,opts,partNo);qq=r.question;ans=r.newAnswer}
      sanitizeQuestionInPlace(qq,meta.type,ans,meta,opts);
      if(['mcq','tf','short','essay'].includes(meta.type)) exammixVerifyStemPreservation(sourceQ,qq,q.originalNum||q.originalIndex+1,newNo,partNo);
      if(meta.type==='tf'){
        exammixVerifyTFPreservation(sourceQ,qq,q.originalNum||q.originalIndex+1,newNo);
        exammixAuditOutputObjects(sourceQ,qq,'II',q.originalNum||q.originalIndex+1,newNo);
      }
      if(meta.type==='mcq'){
        if(opts.outputStyle==='standard') boldStandardMCQLabels(qq);
        qq=formatMCQOptionsTabs(qq,opts.optionLayout||'auto');
        assertMCQIntegrity(qq,newNo,sourceObjectCount);
        exammixVerifyChoicePreservation(sourceQ,qq,q.originalNum||q.originalIndex+1,newNo);
        qq=protectQuestionBlockPagination(qq);
      }
      if(qq.els[0]&&opts.renumber)renumberQuestion(qq.els[0],newNo);
      else if(qq.els[0]) boldLeadingQuestionLabel(qq.els[0]);
      if(qq.els[0]) normalizeQuestionLabelPunctuation(qq.els[0]);
      if(sec.englishMode){
        const lead=qq.els.find(x=>x.localName==='p');
        if(!lead||!exammixEnglishQuestionLabel(lead))throw new Error('Không thể xuất nhãn Question '+newNo+' cho đề tiếng Anh. Đã dừng để tránh tệp Word sai.');
      }
      if(opts.renumber && ['mcq','tf','short','essay'].includes(meta.type))exammixAssertQuestionNumber(qq,newNo,partNo);
      if(meta.type==='mcq')answers.mcq.push(ans);
      else if(meta.type==='tf')answers.tf.push(ans);
      else if(meta.type==='short')answers.short.push(ans);
      else if(meta.type==='essay')answers.essay.push({Cau:newNo,Text:ans||''});
      matrixRows.push({Phan:meta.type==='mcq'?'I':meta.type==='tf'?'II':meta.type==='short'?'III':meta.type==='essay'?'IV':'Khác',CauMoi:newNo,CauGoc:q.originalNum||q.originalIndex+1,MucDo:q.level||'',NhomTron:q.englishBlockKind?('EN:'+q.englishBlockKind):(q.groupMode===null||q.groupMode===undefined?'':('g'+q.groupMode)),CoDinh:q.fixed?'Có':'',DapAn:meta.type==='essay'?(ans?'Có lời giải':'Chưa có'):ans});
      if(q.englishPrefix&&q.englishPrefix.length) qq.englishPrefix=q.englishPrefix.map(x=>x.cloneNode(true));
      if(q.exClusterPrefix&&q.exClusterPrefix.length){
        const firstNew=opts.renumber?newNo:q.exClusterStart,lastNew=opts.renumber?newNo+(q.exClusterEnd-q.exClusterStart):q.exClusterEnd;
        qq.exClusterPrefix=q.exClusterPrefix.map(x=>exClusterRenameIntro(x,q.exClusterStart,q.exClusterEnd,firstNew,lastNew));
      }
      outQs.push(qq);
    });
    // V21.7.2: Khi chọn lọc, không đưa tiêu đề của khối đã bỏ hết câu vào đề xuất.
    // Tên phần phải dựa trên loại câu thực tế; không được để tiêu đề cũ làm kiểm định nhầm.
    if(opts.em217SelectedIds && !outQs.length)return;
    let effectivePart=sectionPartNo(sec);
    let sourceHeaders=(sec.headers||[]).filter(h=>!/^\s*(?:—\s*)?HẾT(?:\s*—)?\s*$/i.test(textOf(h).trim()));
    if(opts.em217SelectedIds){
      const chosenTypes=[...new Set(qs.map(q=>analysis.byOriginalIndex[q.originalIndex]?.type).filter(Boolean))];
      const partByType={mcq:1,tf:2,short:3,essay:4};
      if(chosenTypes.length!==1 || !partByType[chosenTypes[0]]){
        throw new Error('Các câu đã chọn trong cùng một khối Word thuộc nhiều loại hoặc chưa xác định. Hãy kiểm tra tiêu đề Phần I–IV trong Word gốc; không tự trộn để tránh sai cấu trúc.');
      }
      effectivePart=partByType[chosenTypes[0]];
      // Bỏ riêng nhãn phần bị sai; giữ lại nội dung/đoạn ngữ liệu khác.
      sourceHeaders=sourceHeaders.filter(h=>!isPartHeading(textOf(h).trim()));
    }
    resultSections.push({partNo:effectivePart,headers:sourceHeaders.map(x=>x.cloneNode(true)),questions:outQs});
  });
  while(body.firstChild)body.removeChild(body.firstChild);
  resultSections.forEach(s=>{
    const hasPart=(s.headers||[]).some(h=>isPartHeading(textOf(h).trim()));
    if((opts.outputStyle==='standard'||opts.em217SelectedIds) && !hasPart && [1,2,3,4].includes(s.partNo) && s.questions.length){makeStandardSectionIntro(doc,s.partNo,s.questions.length).forEach(x=>body.appendChild(x));}
    s.headers.forEach(x=>body.appendChild(x));
    s.questions.forEach(q=>{(q.englishPrefix||[]).forEach(x=>body.appendChild(x));(q.exClusterPrefix||[]).forEach(x=>{if(x.localName==='p'){setWordKeepFlag(x,'keepNext',true);setWordKeepFlag(x,'keepLines',true)}body.appendChild(x)});q.els.forEach(x=>body.appendChild(x));});
  });
  applyExamHeaderPolicy(body,doc,opts,headerInfo);
  ensureVariantCode(body,headerInfo.code||'',opts.outputStyle==='standard');
  normalizeExamLabelPunctuationInBody(body);
  // ExamMix FIX: luôn chèn HẾT ở cuối từng mã đề để đề riêng và đề ghép đều có dấu kết thúc.
  body.appendChild(makeWParagraph(doc,'— HẾT —',{align:'center',bold:true,size:22,before:0,after:0,line:240}));
  if(parsed.sectPr){const sp=parsed.sectPr.cloneNode(true);if(opts.standardPage && !opts.keepStructure)standardizePage(sp);body.appendChild(sp)}
  if(opts.centerImages && !opts.keepStructure)centerImageParagraphs(body);
  cleanQuestionStartsAllModes(body);
  protectPartHeadingPagination(body);
  if(opts.outputStyle==='standard'){smartCleanExamBody(body);standardizeExamSpacing(body);standardizeExamParagraphLayout(body);canonicalizeStandardExamParagraphs(body);smartCleanExamBody(body);assertSmartCleanExamBody(body);assertCanonicalStandardExam(body);}
  if(opts.normalizeFont && !opts.keepStructure)normalizeDocumentRuns(body);
  if(opts.exammixBodyFontHalfPt)exammixEnforceOutputBodyFont(body,opts.exammixBodyFontHalfPt);
  // Bản Word: giữ màu gốc của phần hành chính, chỉ tô xanh các nhãn cấu trúc theo mẫu.
  if(opts.colorWordLabelsBlue)colorExamStructuralLabels(body,'0000FF');
  const outXml=new XMLSerializer().serializeToString(doc);
  // Bản nguồn PDF: clone riêng rồi chuyển TOÀN BỘ chữ sang màu đen để in rõ, không làm mất màu của Word.
  const printDoc=new DOMParser().parseFromString(outXml,'application/xml');
  const printBody=printDoc.getElementsByTagNameNS('*','body')[0];
  if(printBody)colorAllTextRuns(printBody,'000000');
  const printXml=new XMLSerializer().serializeToString(printDoc);
  const essayAnswerXml=buildEssayAnswerXml(xml,headerInfo,essayItems,opts);
  return {outXml,printXml,essayAnswerXml,answers,matrixRows,total:matrixRows.length};
}

export async function loadDocxXml(input,displayName=''){
  if(!input) throw new Error('Chưa chọn file Word .docx.');
  if(typeof JSZip==='undefined') throw new Error('Lỗi thư viện đọc DOCX nội bộ của ExamMix Pro.');
  const name=(displayName||input.name||'').toLowerCase();
  if(name && !name.endsWith('.docx') && !name.endsWith('.pdf')) throw new Error('Chỉ hỗ trợ .docx hoặc .pdf.');
  try{
    const zip=await JSZip.loadAsync(input);
    const entry=zip.file('word/document.xml');
    if(!entry) throw new Error('Không tìm thấy word/document.xml. File có thể hỏng hoặc không phải DOCX hợp lệ.');
    const xml=await entry.async('string');
    return {zip,xml};
  }catch(e){
    if(e && /requested file could not be read|NotReadableError|permission/i.test(String(e.message||e))){
      throw new Error('Trình duyệt mất quyền đọc file trên ổ đĩa. Hãy bấm “Chọn / đọc lại file”. Nếu file đang mở trong Word/WPS hoặc nằm trên OneDrive/USB, hãy đóng file hoặc sao chép nó vào Desktop rồi chọn lại.');
    }
    throw e;
  }
}