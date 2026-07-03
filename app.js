(function(){
  "use strict";

  /* ============ STORAGE ============ */
  const LS_PRODUCTS = "estoque_products";
  const LS_HISTORY  = "estoque_history";
  const LS_PIN      = "estoque_pin";

  const load = (k, fallback) => {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; }
    catch(e){ return fallback; }
  };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  let products = load(LS_PRODUCTS, []);
  let history  = load(LS_HISTORY, []);

  function persistProducts(){ save(LS_PRODUCTS, products); }
  function persistHistory(){ save(LS_HISTORY, history); }

  /* Seed demo data no primeiro acesso */
  if(products.length === 0 && history.length === 0 && !localStorage.getItem("estoque_seeded")){
    products = [
      {id:"p1", name:"Fone Bluetooth XR200", code:"7891234560012", category:"Áudio", qty:14, min:5, price:129.9, updatedAt:Date.now()},
      {id:"p2", name:"Carregador USB-C 20W", code:"7891234560029", category:"Acessórios", qty:3, min:6, price:39.9, updatedAt:Date.now()},
      {id:"p3", name:"Mouse sem fio M90", code:"7891234560036", category:"Periféricos", qty:0, min:4, price:59.9, updatedAt:Date.now()},
      {id:"p4", name:"Cabo HDMI 2m", code:"7891234560043", category:"Cabos", qty:22, min:8, price:24.5, updatedAt:Date.now()}
    ];
    persistProducts();
    localStorage.setItem("estoque_seeded","1");
  }

  /* ============ TOAST ============ */
  let toastTimer;
  function toast(msg){
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=> el.classList.remove("show"), 1800);
  }

  /* ============ LOCK SCREEN ============ */
  const lockEl = document.getElementById("lock");
  const lockSub = document.getElementById("lock-sub");
  const pinDotsEl = document.getElementById("pin-dots");
  const keypadEl = document.getElementById("keypad");
  const lockErr = document.getElementById("lock-err");

  let pinBuffer = "";
  let pinMode = localStorage.getItem(LS_PIN) ? "enter" : "create";
  let pinStage1 = null;

  function renderDots(){
    pinDotsEl.innerHTML = "";
    for(let i=0;i<4;i++){
      const d = document.createElement("i");
      if(i < pinBuffer.length) d.classList.add("filled");
      pinDotsEl.appendChild(d);
    }
  }

  function buildKeypad(){
    keypadEl.innerHTML = "";
    const keys = ["1","2","3","4","5","6","7","8","9","","0","del"];
    keys.forEach(k=>{
      const b = document.createElement("button");
      if(k === ""){ b.style.visibility="hidden"; }
      else if(k === "del"){
        b.classList.add("action"); b.textContent = "Apagar";
        b.addEventListener("click", ()=>{ pinBuffer = pinBuffer.slice(0,-1); lockErr.textContent=""; renderDots(); });
      } else {
        b.textContent = k;
        b.addEventListener("click", ()=> onPinKey(k));
      }
      keypadEl.appendChild(b);
    });
  }

  function onPinKey(k){
    if(pinBuffer.length >= 4) return;
    pinBuffer += k;
    lockErr.textContent = "";
    renderDots();
    if(pinBuffer.length === 4) setTimeout(handlePinComplete, 150);
  }

  function handlePinComplete(){
    if(pinMode === "create"){
      if(!pinStage1){
        pinStage1 = pinBuffer;
        pinBuffer = "";
        lockSub.textContent = "Confirme o PIN";
        renderDots();
      } else {
        if(pinStage1 === pinBuffer){
          localStorage.setItem(LS_PIN, pinBuffer);
          unlock();
        } else {
          lockErr.textContent = "PINs diferentes. Tente novamente.";
          pinStage1 = null;
          pinBuffer = "";
          lockSub.textContent = "Crie um PIN de acesso";
          renderDots();
        }
      }
    } else {
      const saved = localStorage.getItem(LS_PIN);
      if(pinBuffer === saved){
        unlock();
      } else {
        lockErr.textContent = "PIN incorreto";
        pinBuffer = "";
        renderDots();
      }
    }
  }

  function unlock(){
    lockEl.style.display = "none";
    pinBuffer = ""; pinStage1 = null;
  }

  function showLock(mode){
    pinMode = mode || (localStorage.getItem(LS_PIN) ? "enter" : "create");
    pinBuffer = ""; pinStage1 = null;
    lockErr.textContent = "";
    lockSub.textContent = pinMode === "create" ? "Crie um PIN de acesso" : "Digite seu PIN";
    renderDots();
    lockEl.style.display = "flex";
  }

  buildKeypad();
  renderDots();
  lockSub.textContent = pinMode === "create" ? "Crie um PIN de acesso" : "Digite seu PIN";
  document.getElementById("btn-lock").addEventListener("click", ()=> showLock("enter"));

  /* ============ NAV / VIEWS ============ */
  const tabBtns = document.querySelectorAll(".tab-btn");
  const views = {
    lista: document.getElementById("view-lista"),
    scanner: document.getElementById("view-scanner"),
    historico: document.getElementById("view-historico"),
    ajustes: document.getElementById("view-ajustes"),
  };

  function goto(view){
    Object.keys(views).forEach(k=>{
      views[k].classList.toggle("active", k===view);
    });
    tabBtns.forEach(b=> b.classList.toggle("active", b.dataset.view===view));
    document.getElementById("fab-add").style.display = (view==="scanner") ? "none" : "flex";
    if(view === "historico") renderHistory();
    if(view === "lista") renderList();
    if(view === "scanner") startScanner(); else stopScanner();
  }
  tabBtns.forEach(b=> b.addEventListener("click", ()=> goto(b.dataset.view)));

  /* ============ STATS ============ */
  function renderStats(){
    const total = products.length;
    const low = products.filter(p=> p.qty > 0 && p.qty <= p.min).length;
    const out = products.filter(p=> p.qty <= 0).length;
    document.getElementById("stats").innerHTML = `
      <div class="stat"><div class="n mono">${total}</div><div class="l">Itens</div></div>
      <div class="stat warn"><div class="n mono">${low}</div><div class="l">Estoque baixo</div></div>
      <div class="stat danger"><div class="n mono">${out}</div><div class="l">Em falta</div></div>
    `;
  }

  /* ============ FILTERS ============ */
  let activeFilter = "todos";
  function renderFilters(){
    const cats = Array.from(new Set(products.map(p=>p.category).filter(Boolean)));
    const chips = ["todos","baixo","falta", ...cats];
    document.getElementById("filters").innerHTML = chips.map(c=>{
      const label = c==="todos" ? "Todos" : c==="baixo" ? "Estoque baixo" : c==="falta" ? "Em falta" : c;
      return `<button class="chip ${activeFilter===c?'active':''}" data-c="${c}">${label}</button>`;
    }).join("");
    document.querySelectorAll(".chip").forEach(ch=>{
      ch.addEventListener("click", ()=>{ activeFilter = ch.dataset.c; renderFilters(); renderList(); });
    });
  }

  /* ============ PRODUCT LIST ============ */
  function statusOf(p){
    if(p.qty <= 0) return "out";
    if(p.qty <= p.min) return "low";
    return "good";
  }
  function currency(n){
    return (n||0).toLocaleString("pt-BR", {style:"currency", currency:"BRL"});
  }

  function renderList(){
    renderStats();
    renderFilters();
    const q = document.getElementById("search").value.trim().toLowerCase();
    let list = products.filter(p=>{
      const matchesQ = !q || p.name.toLowerCase().includes(q) || (p.code||"").toLowerCase().includes(q);
      let matchesFilter = true;
      if(activeFilter === "baixo") matchesFilter = statusOf(p) === "low";
      else if(activeFilter === "falta") matchesFilter = statusOf(p) === "out";
      else if(activeFilter !== "todos") matchesFilter = p.category === activeFilter;
      return matchesQ && matchesFilter;
    });
    list.sort((a,b)=> a.name.localeCompare(b.name));

    const container = document.getElementById("product-list");
    if(list.length === 0){
      container.innerHTML = `<div class="empty"><div class="big">📦</div>Nenhum produto encontrado.<br>Toque em “+” para cadastrar.</div>`;
      return;
    }
    container.innerHTML = list.map(p=>{
      const st = statusOf(p);
      const badge = st==="good" ? `<span class="badge good">Ok</span>` : st==="low" ? `<span class="badge low">Baixo</span>` : `<span class="badge out">Em falta</span>`;
      return `
      <div class="card ${st}" data-id="${p.id}">
        <div class="tag-strip"></div>
        <div class="card-body">
          <div class="card-top">
            <div>
              <div class="card-name">${escapeHtml(p.name)}</div>
              <div class="card-code mono">${escapeHtml(p.code||'sem código')}</div>
            </div>
            ${badge}
          </div>
          <div class="card-mid">
            <div class="card-price mono">${currency(p.price)}</div>
            <div class="qty-ctrl">
              <button data-act="dec" data-id="${p.id}">−</button>
              <div class="n mono">${p.qty}</div>
              <button data-act="inc" data-id="${p.id}">+</button>
            </div>
          </div>
        </div>
        <div class="card-actions">
          <button data-act="edit" data-id="${p.id}">✎</button>
        </div>
      </div>`;
    }).join("");

    container.querySelectorAll("[data-act='inc']").forEach(b=> b.addEventListener("click", ()=> adjustQty(b.dataset.id, 1)));
    container.querySelectorAll("[data-act='dec']").forEach(b=> b.addEventListener("click", ()=> adjustQty(b.dataset.id, -1)));
    container.querySelectorAll("[data-act='edit']").forEach(b=> b.addEventListener("click", ()=> openProductSheet(b.dataset.id)));
  }

  function escapeHtml(s){
    const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML;
  }
  document.getElementById("search").addEventListener("input", renderList);

  function adjustQty(id, delta){
    const p = products.find(x=>x.id===id);
    if(!p) return;
    if(p.qty + delta < 0) return;
    p.qty += delta;
    p.updatedAt = Date.now();
    persistProducts();
    logMovement(p, delta > 0 ? "in" : "out", Math.abs(delta));
    renderList();
  }

  function logMovement(p, type, qty){
    history.unshift({
      id: "h" + Date.now() + Math.random().toString(36).slice(2,6),
      productId: p.id,
      name: p.name,
      code: p.code,
      type, qty,
      date: Date.now()
    });
    history = history.slice(0, 300);
    persistHistory();
  }

  /* ============ HISTORY VIEW ============ */
  function renderHistory(){
    const el = document.getElementById("history-list");
    if(history.length === 0){
      el.innerHTML = `<div class="empty"><div class="big">🕓</div>Nenhuma movimentação ainda.</div>`;
      return;
    }
    el.innerHTML = history.map(h=>{
      const dt = new Date(h.date);
      const dstr = dt.toLocaleDateString("pt-BR") + " " + dt.toLocaleTimeString("pt-BR",{hour:'2-digit',minute:'2-digit'});
      return `
      <div class="hist-item">
        <div class="hist-dot ${h.type}"></div>
        <div class="hist-body">
          <div class="hist-name">${escapeHtml(h.name)}</div>
          <div class="hist-meta">${dstr} · ${escapeHtml(h.code||'')}</div>
        </div>
        <div class="hist-qty ${h.type}">${h.type==='in'?'+':'−'}${h.qty}</div>
      </div>`;
    }).join("");
  }

  /* ============ PRODUCT SHEET (ADD/EDIT) ============ */
  const sheetProduct = document.getElementById("sheet-product");
  let editingId = null;

  function openProductSheet(id, prefillCode){
    editingId = id || null;
    const title = document.getElementById("product-sheet-title");
    const delBtn = document.getElementById("btn-delete-product");
    if(id){
      const p = products.find(x=>x.id===id);
      title.textContent = "Editar produto";
      document.getElementById("f-name").value = p.name;
      document.getElementById("f-code").value = p.code || "";
      document.getElementById("f-category").value = p.category || "";
      document.getElementById("f-qty").value = p.qty;
      document.getElementById("f-min").value = p.min;
      document.getElementById("f-price").value = p.price;
      delBtn.style.display = "block";
    } else {
      title.textContent = "Novo produto";
      document.getElementById("f-name").value = "";
      document.getElementById("f-code").value = prefillCode || "";
      document.getElementById("f-category").value = "";
      document.getElementById("f-qty").value = 0;
      document.getElementById("f-min").value = 5;
      document.getElementById("f-price").value = "";
      delBtn.style.display = "none";
    }
    sheetProduct.classList.add("show");
  }
  function closeProductSheet(){ sheetProduct.classList.remove("show"); editingId = null; }

  document.getElementById("fab-add").addEventListener("click", ()=> openProductSheet(null));
  document.getElementById("btn-cancel-product").addEventListener("click", closeProductSheet);
  sheetProduct.addEventListener("click", (e)=>{ if(e.target === sheetProduct) closeProductSheet(); });

  document.getElementById("btn-save-product").addEventListener("click", ()=>{
    const name = document.getElementById("f-name").value.trim();
    if(!name){ toast("Digite o nome do produto"); return; }
    const code = document.getElementById("f-code").value.trim();
    const category = document.getElementById("f-category").value.trim();
    const qty = Math.max(0, parseInt(document.getElementById("f-qty").value || "0", 10));
    const min = Math.max(0, parseInt(document.getElementById("f-min").value || "0", 10));
    const price = parseFloat(document.getElementById("f-price").value || "0");

    if(editingId){
      const p = products.find(x=>x.id===editingId);
      const oldQty = p.qty;
      Object.assign(p, {name, code, category, qty, min, price, updatedAt:Date.now()});
      if(qty !== oldQty) {
        const delta = qty - oldQty;
        logMovement(p, delta > 0 ? "in" : "out", Math.abs(delta));
      }
      toast("Produto atualizado");
    } else {
      const newProd = {
        id: "p" + Date.now() + Math.random().toString(36).slice(2,6),
        name, code, category, qty, min, price, updatedAt: Date.now()
      };
      products.push(newProd);
      if(qty > 0) logMovement(newProd, "in", qty);
      toast("Produto cadastrado");
    }
    persistProducts();
    closeProductSheet();
    renderList();
  });

  document.getElementById("btn-delete-product").addEventListener("click", ()=>{
    if(!editingId) return;
    products = products.filter(p=>p.id !== editingId);
    persistProducts();
    toast("Produto excluído");
    closeProductSheet();
    renderList();
  });

  /* ============ SCANNER ============ */
  let html5QrCode = null;
  let scannerRunning = false;

  function startScanner(){
    document.getElementById("scan-result-area").innerHTML = "";
    if(scannerRunning) return;
    if(typeof Html5Qrcode === "undefined"){
      document.getElementById("reader").innerHTML = `<div style="color:#9CA3AA; padding:20px; font-size:12.5px; text-align:center;">Câmera indisponível. Use o código manual abaixo.</div>`;
      return;
    }
    html5QrCode = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 240, height: 140 } };
    html5QrCode.start(
      { facingMode: "environment" },
      config,
      (decodedText)=>{ onScanSuccess(decodedText); },
      (err)=>{ /* ignora erros de busca de frames */ }
    ).then(()=>{ scannerRunning = true; })
     .catch((err)=>{
       document.getElementById("reader").innerHTML = `<div style="color:#9CA3AA; padding:20px; font-size:12.5px; text-align:center;">Não foi possível acessar a câmera.<br>Permita o acesso ou use o código manual.</div>`;
     });
  }

  function stopScanner(){
    if(html5QrCode && scannerRunning){
      html5QrCode.stop().then(()=>{
        html5QrCode.clear();
        scannerRunning = false;
      }).catch(()=>{ scannerRunning = false; });
    }
  }

  function onScanSuccess(code){
    if(!scannerRunning) return;
    handleScannedCode(code);
    scannerRunning = false;
    if(html5QrCode){
      html5QrCode.pause(true);
      setTimeout(()=>{ if(html5QrCode){ html5QrCode.resume(); scannerRunning = true; } }, 1500);
    }
  }

  document.getElementById("btn-manual-scan").addEventListener("click", ()=>{
    const code = document.getElementById("manual-code-input").value.trim();
    if(!code){ toast("Digite um código"); return; }
    handleScannedCode(code);
  });

  function handleScannedCode(code){
    const p = products.find(x=> (x.code||"").trim() === code.trim());
    const area = document.getElementById("scan-result-area");
    if(p){
      area.innerHTML = `
        <div class="scan-result">
          <div class="card-name" style="margin-bottom:4px;">${escapeHtml(p.name)}</div>
          <div class="card-code mono" style="margin-bottom:10px;">${escapeHtml(p.code)} · Estoque atual: ${p.qty}</div>
          <div class="sheet-actions" style="margin-top:0;">
            <button class="btn ghost" id="scan-remove">− Retirar 1</button>
            <button class="btn primary" id="scan-add">+ Adicionar 1</button>
          </div>
        </div>`;
      document.getElementById("scan-add").addEventListener("click", ()=>{ adjustQty(p.id, 1); toast("Adicionado ao estoque"); handleScannedCode(code); });
      document.getElementById("scan-remove").addEventListener("click", ()=>{ adjustQty(p.id, -1); toast("Retirado do estoque"); handleScannedCode(code); });
    } else {
      area.innerHTML = `
        <div class="scan-result">
          <div class="card-name" style="margin-bottom:4px;">Código não encontrado</div>
          <div class="card-code mono" style="margin-bottom:10px;">${escapeHtml(code)}</div>
          <button class="btn primary block" id="scan-create">Cadastrar novo produto</button>
        </div>`;
      document.getElementById("scan-create").addEventListener("click", ()=>{
        goto("lista");
        openProductSheet(null, code);
      });
    }
  }

  /* ============ SETTINGS / BACKUP ============ */
  document.getElementById("btn-export").addEventListener("click", ()=>{
    const data = { products, history, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "estoque-backup-" + new Date().toISOString().slice(0,10) + ".json";
    a.click();
    toast("Backup exportado");
  });

  document.getElementById("btn-import").addEventListener("click", ()=> document.getElementById("file-import").click());
  document.getElementById("file-import").addEventListener("change", (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev)=>{
      try{
        const data = JSON.parse(ev.target.result);
        if(Array.isArray(data.products)){
          products = data.products;
          history = Array.isArray(data.history) ? data.history : [];
          persistProducts(); persistHistory();
          renderList();
          toast("Backup importado");
        } else { toast("Arquivo inválido"); }
      } catch(err){ toast("Erro ao ler arquivo"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  const sheetPin = document.getElementById("sheet-pin");
  document.getElementById("btn-change-pin").addEventListener("click", ()=>{
    document.getElementById("f-newpin").value = "";
    sheetPin.classList.add("show");
  });
  document.getElementById("btn-cancel-pin").addEventListener("click", ()=> sheetPin.classList.remove("show"));
  sheetPin.addEventListener("click", (e)=>{ if(e.target === sheetPin) sheetPin.classList.remove("show"); });
  
  document.getElementById("btn-save-pin").addEventListener("click", ()=>{
    const val = document.getElementById("f-newpin").value.trim();
    if(!/^\d{4}$/.test(val)){ toast("PIN precisa ter 4 números"); return; }
    localStorage.setItem(LS_PIN, val);
    sheetPin.classList.remove("show");
    toast("PIN alterado");
  });

  document.getElementById("btn-wipe").addEventListener("click", ()=>{
    if(!confirm("Isso vai apagar todos os produtos, histórico e o PIN. Continuar?")) return;
    localStorage.removeItem(LS_PRODUCTS);
    localStorage.removeItem(LS_HISTORY);
    localStorage.removeItem(LS_PIN);
    localStorage.removeItem("estoque_seeded");
    location.reload();
  });

  /* ============ INIT ============ */
  renderList();
  showLock();
})();