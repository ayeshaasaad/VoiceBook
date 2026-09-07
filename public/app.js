(function(){
  const micBtn = document.getElementById('micBtn');
  const micStatus = document.getElementById('micStatus');
  const manualLink = document.getElementById('manualLink');
  const reviewCard = document.getElementById('reviewCard');
  const revName = document.getElementById('revName');
  const revAmount = document.getElementById('revAmount');
  const saveBtn = document.getElementById('saveBtn');
  const redoBtn = document.getElementById('redoBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const formHint = document.getElementById('formHint');
  const segBtns = document.querySelectorAll('.seg-btn');
  const searchInput = document.getElementById('searchInput');
  const customerTbody = document.getElementById('customerTbody');
  const feedCount = document.getElementById('feedCount');
  const receiptPrompt = document.getElementById('receiptPrompt');
  const receiptLine1 = document.getElementById('receiptLine1');
  const receiptLine2 = document.getElementById('receiptLine2');
  const shareBtn = document.getElementById('shareBtn');
  const dismissReceiptBtn = document.getElementById('dismissReceiptBtn');

  let currentType = 'advance';
  let customers = [];
  let openCardId = null;

  // ---------- speech recognition ----------
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'en-US'; // gives Latin-script transcript & auto number conversion
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      micBtn.classList.add('listening');
      micStatus.textContent = 'Sun raha hoon...';
    };
    recognition.onerror = (e) => {
      micBtn.classList.remove('listening');
      micStatus.textContent = 'Mic ki ijazat nahi mili ya sunai nahi diya. Dobara try karo.';
    };
    recognition.onend = () => {
      micBtn.classList.remove('listening');
    };
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      handleTranscript(transcript);
    };
  } else {
    micStatus.textContent = 'Yeh browser voice recognition support nahi karta. Manually likho.';
    micBtn.disabled = true;
  }

  micBtn.addEventListener('click', () => {
    if (!recognition) return;
    micStatus.textContent = 'Bolo...';
    try { recognition.start(); } catch(e) { /* already started */ }
  });

  manualLink.addEventListener('click', () => {
    openReview('', '', 'advance');
  });

  // ---------- extraction heuristics ----------
  const QARZA_WORDS = ['qarza','qarz','udhaar','udhar','karza','karz'];
  const ADVANCE_WORDS = ['advance','peshgi','paishgi'];
  const FILLER_WORDS = ['ka','ki','ke','ne','de','liye','rupay','rupaye','rupees','rs','hai','h'];

  function extractFromTranscript(text) {
    const lower = text.toLowerCase();
    const words = lower.split(/\s+/).filter(Boolean);

    // amount: first number-like token
    let amount = '';
    let amountIdx = -1;
    for (let i=0;i<words.length;i++){
      const digits = words[i].replace(/,/g,'').match(/^\d+$/);
      if (digits) { amount = digits[0]; amountIdx = i; break; }
    }
    if (!amount) {
      const m = lower.replace(/,/g,'').match(/\d+/);
      if (m) amount = m[0];
    }

    // type
    let type = 'advance';
    if (QARZA_WORDS.some(w => lower.includes(w))) type = 'qarza';
    else if (ADVANCE_WORDS.some(w => lower.includes(w))) type = 'advance';

    // name: words before the amount/type keyword, minus filler words
    let nameWords = [];
    for (let i=0;i<words.length;i++){
      const w = words[i];
      if (i === amountIdx) break;
      if (QARZA_WORDS.includes(w) || ADVANCE_WORDS.includes(w)) break;
      if (FILLER_WORDS.includes(w)) continue;
      nameWords.push(w);
    }
    let name = nameWords.join(' ');
    if (name) name = name.replace(/\b\w/g, c => c.toUpperCase());

    return { name, amount, type };
  }

  function handleTranscript(text) {
    const { name, amount, type } = extractFromTranscript(text);
    openReview(name, amount, type);
    micStatus.textContent = 'Bolne ke liye button dabao';
  }

  // ---------- review form ----------
  function openReview(name, amount, type) {
    revName.value = name || '';
    revAmount.value = amount || '';
    setType(type || 'advance');
    formHint.textContent = '';
    reviewCard.style.display = 'block';
    reviewCard.scrollIntoView({ behavior:'smooth', block:'center' });
    if (!name) revName.focus();
  }

  function closeReview() {
    reviewCard.style.display = 'none';
  }

  function setType(type) {
    currentType = type;
    segBtns.forEach(b => b.classList.toggle('active', b.dataset.type === type));
  }

  segBtns.forEach(b => b.addEventListener('click', () => setType(b.dataset.type)));

  redoBtn.addEventListener('click', () => {
    closeReview();
    micBtn.click();
  });
  cancelBtn.addEventListener('click', closeReview);

  saveBtn.addEventListener('click', async () => {
    const name = revName.value.trim();
    const amount = Number(revAmount.value);
    if (!name) { formHint.textContent = 'Naam likho.'; return; }
    if (!amount || amount <= 0) { formHint.textContent = 'Sahi raqam do.'; return; }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Save ho raha hai...';
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, amount, type: currentType })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kuch ghalat hua.');
      closeReview();
      await loadCustomers();
      showReceiptPrompt(name, amount, currentType, Date.now());
    } catch(e) {
      formHint.textContent = e.message;
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Karo';
    }
  });

  // ---------- receipt image + share ----------
  let lastReceipt = null; // { name, amount, type, ts }

  function showReceiptPrompt(name, amount, type, ts) {
    lastReceipt = { name, amount, type, ts };
    receiptLine1.textContent = 'Receipt taiyar hai';
    receiptLine2.textContent = `${name} — ${type === 'advance' ? 'Advance' : 'Qarza'} ${fmtMoney(amount)}`;
    receiptPrompt.style.display = 'flex';
  }

  function hideReceiptPrompt() {
    receiptPrompt.style.display = 'none';
    lastReceipt = null;
  }

  dismissReceiptBtn.addEventListener('click', hideReceiptPrompt);

  async function buildReceiptBlob({ name, amount, type, ts }) {
    try { await document.fonts.load('600 40px Fraunces'); await document.fonts.load('600 20px Sora'); } catch(e){}

    const W = 640, H = 400;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    // background
    ctx.fillStyle = '#161f1a';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#2a3a30';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W-2, H-2);

    // header
    ctx.fillStyle = '#4fb8a0';
    ctx.beginPath();
    ctx.arc(40, 46, 6, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#eef4ee';
    ctx.font = '600 26px Fraunces, serif';
    ctx.fillText('Voicebook', 56, 55);

    // divider
    ctx.strokeStyle = '#2a3a30';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(40, 90); ctx.lineTo(W-40, 90); ctx.stroke();

    // type badge
    const isAdvance = type === 'advance';
    const badgeColor = isAdvance ? '#cf9c3b' : '#d16b56';
    const badgeBg = isAdvance ? 'rgba(207,156,59,0.15)' : 'rgba(209,107,86,0.15)';
    const badgeText = isAdvance ? 'ADVANCE' : 'QARZA';
    ctx.font = '600 14px Sora, sans-serif';
    const badgeW = ctx.measureText(badgeText).width + 28;
    ctx.fillStyle = badgeBg;
    roundRect(ctx, 40, 116, badgeW, 30, 15);
    ctx.fill();
    ctx.fillStyle = badgeColor;
    ctx.fillText(badgeText, 54, 136);

    // name
    ctx.fillStyle = '#eef4ee';
    ctx.font = '600 30px Fraunces, serif';
    wrapText(ctx, name, 40, 190, W-80, 34);

    // amount
    ctx.fillStyle = badgeColor;
    ctx.font = '700 46px Fraunces, serif';
    ctx.fillText(fmtMoney(amount), 40, 250);

    // date
    const dateStr = new Date(ts).toLocaleString('en-PK', { day:'numeric', month:'short', year:'numeric', hour:'numeric', minute:'2-digit' });
    ctx.fillStyle = '#8fa398';
    ctx.font = '400 15px Sora, sans-serif';
    ctx.fillText(dateStr, 40, 290);

    // footer
    ctx.strokeStyle = '#2a3a30';
    ctx.beginPath(); ctx.moveTo(40, H-50); ctx.lineTo(W-40, H-50); ctx.stroke();
    ctx.fillStyle = '#4b5c52';
    ctx.font = '400 13px Sora, sans-serif';
    ctx.fillText('Voicebook se banaya gaya', 40, H-28);

    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y, x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x, y+h, r);
    ctx.arcTo(x, y+h, x, y, r);
    ctx.arcTo(x, y, x+w, y, r);
    ctx.closePath();
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '', lines = [];
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line); line = w;
      } else line = test;
    }
    lines.push(line);
    lines.slice(0,2).forEach((l,i) => ctx.fillText(l, x, y + i*lineHeight));
  }

  shareBtn.addEventListener('click', async () => {
    if (!lastReceipt) return;
    shareBtn.disabled = true;
    shareBtn.textContent = 'Taiyar ho raha...';
    try {
      const blob = await buildReceiptBlob(lastReceipt);
      const file = new File([blob], 'receipt.png', { type: 'image/png' });
      const shareText = `${lastReceipt.name} — ${lastReceipt.type === 'advance' ? 'Advance' : 'Qarza'} ${fmtMoney(lastReceipt.amount)}`;

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Voicebook Receipt', text: shareText });
        hideReceiptPrompt();
      } else {
        // fallback: download image + open WhatsApp with text, user attaches manually
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'receipt.png';
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
        receiptLine2.textContent = 'Image download ho gayi — chat mein attach karke bhejo.';
      }
    } catch(e) {
      if (e.name !== 'AbortError') {
        receiptLine2.textContent = 'Share nahi ho saka. Dobara try karo.';
      }
    } finally {
      shareBtn.disabled = false;
      shareBtn.textContent = 'Bhejo';
    }
  });

  // ---------- customer list ----------
  function fmtMoney(n) {
    return 'Rs ' + Number(n).toLocaleString('en-PK');
  }

  function timeAgo(ts) {
    const diff = Math.floor((Date.now()-ts)/1000);
    if (diff < 15) return 'abhi';
    if (diff < 60) return diff+' second pehle';
    const mins = Math.floor(diff/60);
    if (mins < 60) return mins+' minute pehle';
    const hrs = Math.floor(mins/60);
    if (hrs < 24) return hrs+' ghante pehle';
    const days = Math.floor(hrs/24);
    return days+' din pehle';
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  async function loadCustomers() {
    const res = await fetch('/api/customers');
    customers = await res.json();
    renderList();
  }

  function renderList() {
    const q = searchInput.value.trim().toLowerCase();
    const filtered = q
      ? customers.filter(c => c.name.toLowerCase().includes(q))
      : customers;

    feedCount.textContent = customers.length ? customers.length+' customers' : '';
    customerTbody.innerHTML = '';

    if (filtered.length === 0) {
      const msg = customers.length ? 'Koi customer nahi mila.' : 'Abhi tak koi customer add nahi hua.<br>Mic dabao aur bolo!';
      customerTbody.innerHTML = `<tr class="empty-row"><td colspan="4">${msg}</td></tr>`;
      return;
    }

    filtered.forEach(c => {
      const isOpen = openCardId === c.id;

      const row = document.createElement('tr');
      row.className = 'cust-row';
      row.innerHTML = `
        <td class="t-name">${escapeHtml(c.name)}</td>
        <td class="t-advance">${fmtMoney(c.advanceTotal)}</td>
        <td class="t-qarza">${fmtMoney(c.qarzaTotal)}</td>
        <td class="t-caret">${isOpen ? '▾' : '▸'}</td>
      `;
      row.addEventListener('click', () => {
        openCardId = openCardId === c.id ? null : c.id;
        renderList();
      });
      customerTbody.appendChild(row);

      if (isOpen) {
        const txHtml = c.transactions.map(t => `
          <div class="tx-row">
            <div class="tx-left">
              <span class="tx-badge ${t.type}">${t.type === 'advance' ? 'Advance' : 'Qarza'}</span>
              <span class="tx-time">${timeAgo(t.ts)}</span>
            </div>
            <div>
              <span class="tx-amt">${fmtMoney(t.amount)}</span>
              <button class="tx-del" data-cust="${c.id}" data-tx="${t.id}">Hatao</button>
            </div>
          </div>
        `).join('');

        const detailRow = document.createElement('tr');
        detailRow.className = 'detail-row';
        detailRow.innerHTML = `
          <td colspan="4">
            <div class="detail-inner">
              ${txHtml || '<div style="color:var(--muted); font-size:0.85rem;">Koi transaction nahi.</div>'}
              <button class="cust-del" data-custdel="${c.id}">Yeh customer poora hatao</button>
            </div>
          </td>
        `;
        customerTbody.appendChild(detailRow);
      }
    });

    customerTbody.querySelectorAll('.tx-del').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const custId = btn.dataset.cust;
        const txId = btn.dataset.tx;
        await fetch(`/api/customers/${custId}/transactions/${txId}`, { method:'DELETE' });
        await loadCustomers();
      });
    });
    customerTbody.querySelectorAll('[data-custdel]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Pakka is customer ko poora hatana hai?')) return;
        await fetch(`/api/customers/${btn.dataset.custdel}`, { method:'DELETE' });
        openCardId = null;
        await loadCustomers();
      });
    });
  }

  searchInput.addEventListener('input', renderList);

  loadCustomers();
})();
