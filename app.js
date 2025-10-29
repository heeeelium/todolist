// app.js — update: big time card + keep previous behavior
document.addEventListener('DOMContentLoaded', () => {
  /* CONFIG */
  const HOURS = 24;
  const DAYS_BEFORE = 10;
  const DAYS_AFTER = 30;
  const DATE_COL_PX = 120;
  let HOUR_PX = (function(){ const v = getComputedStyle(document.documentElement).getPropertyValue('--hour-px'); const n = parseInt(v); return isNaN(n) ? 86 : n; })();
  const HEADER_H = 48;
  const DAY_H = 68;
  const STORAGE_KEY = 'agenda_modern_v5';

  /* DOM */
  const viewport = document.getElementById('viewport');
  const inner = document.getElementById('inner');
  const hoursEl = document.getElementById('hours');
  const daysEl = document.getElementById('days');
  const gridOverlay = document.getElementById('gridOverlay');
  const todoList = document.getElementById('todoList');

  const nameEl = document.getElementById('name');
  const descEl = document.getElementById('description');
  const durationEl = document.getElementById('duration');
  const typeEl = document.getElementById('type');
  const startEl = document.getElementById('startTime');
  const addBtn = document.getElementById('addBtn');
  const clearBtn = document.getElementById('clearBtn');
  const priorityInput = document.getElementById('priority'); // accessible hidden checkbox

  const nowBig = document.getElementById('nowDisplayBig');
  const nowSmall = document.getElementById('nowDisplaySmall');

  // modal
  const modalBackdrop = document.getElementById('modalBackdrop');
  const modalBody = document.getElementById('modalBody');
  const modalFooter = document.getElementById('modalFooter');
  const modalTitle = document.getElementById('modalTitle');

  /* HELPERS */
  function uid(){ return 'id-' + Date.now() + '-' + Math.floor(Math.random()*10000) }
  function load(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }catch{ return [] } }
  function save(items){ localStorage.setItem(STORAGE_KEY, JSON.stringify(items)) }
  function colorFor(it){
    if(it.priority) return '#ef4444';
    if(it.type === 'work') return '#2563eb';
    if(it.type === 'personal') return '#10b981';
    return '#f59e0b';
  }
  function toKey(d){ return d.toISOString().slice(0,10) }
  function buildDateRange(){ const arr=[]; const start=new Date(); start.setHours(0,0,0,0); start.setDate(start.getDate()-DAYS_BEFORE); for(let i=0;i<(DAYS_BEFORE+1+DAYS_AFTER);i++){ const d=new Date(start); d.setDate(start.getDate()+i); arr.push({date:d,key:toKey(d)}); } return arr }
  let DATE_RANGE = buildDateRange();

  /* NOW-LINE element */
  let nowLine = null;
  function ensureNowLine(){
    if(nowLine) return
    nowLine = document.createElement('div')
    nowLine.className = 'now-line'
    nowLine.style.display = 'none'
    inner.appendChild(nowLine)
  }

  /* GRID BUILD functions (same as before) */
  function computeSizes(){ const trackWidth = DATE_COL_PX + HOURS * HOUR_PX; const trackHeight = HEADER_H + DATE_RANGE.length * DAY_H; return { trackWidth, trackHeight } }
  function buildHours(trackWidth){
    while(hoursEl.children.length>1) hoursEl.removeChild(hoursEl.lastChild)
    hoursEl.style.width = trackWidth + 'px'
    for(let h=0; h<HOURS; h++){
      const el = document.createElement('div'); el.className='hour'; el.style.width = HOUR_PX + 'px'; el.textContent = String(h).padStart(2,'0') + ':00'; hoursEl.appendChild(el)
    }
  }
  function buildDayRows(trackWidth){
    daysEl.innerHTML = ''
    inner.style.width = trackWidth + 'px'
    inner.style.minWidth = trackWidth + 'px'
    const totalH = HEADER_H + DATE_RANGE.length * DAY_H
    inner.style.height = totalH + 'px'

    // find today's index in DATE_RANGE
    const todayKey = toKey(new Date())
    const todayIdx = DATE_RANGE.findIndex(d => d.key === todayKey)

    DATE_RANGE.forEach((d, idx) => {
      const row = document.createElement('div'); row.className = 'day-row' + (idx%2 ? ' alt' : '')
      row.style.height = DAY_H + 'px'
      const dateCell = document.createElement('div'); dateCell.className = 'date-cell'; dateCell.textContent = d.date.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})

      // mark past days (strictly before today) as grayed
      if(todayIdx >= 0 && idx < todayIdx){
        row.classList.add('past')
        // stronger gray shading for past days (inline style so you don't have to edit CSS)
        row.style.background = 'rgba(0,0,0,0.15)'
        dateCell.style.opacity = '0.85'
      }

      row.appendChild(dateCell)
      for(let h=0; h<HOURS; h++){ const hc = document.createElement('div'); hc.className='hour-cell'; hc.style.width = HOUR_PX + 'px'; row.appendChild(hc) }
      daysEl.appendChild(row)
    })
  }
  function buildGridOverlay(trackWidth, trackHeight){
    gridOverlay.style.width = trackWidth + 'px'
    gridOverlay.style.height = trackHeight + 'px'
    const faint = 'rgba(11,17,32,0.08)'
    const strong = 'rgba(11,17,32,0.18)'
    gridOverlay.style.backgroundImage = `
      repeating-linear-gradient(90deg,
        transparent 0px,
        transparent ${Math.max(6, HOUR_PX-1)}px,
        ${faint} ${Math.max(6, HOUR_PX-1)}px,
        ${faint} ${Math.max(6, HOUR_PX)}px)
    `
    gridOverlay.style.left = '0px'; gridOverlay.style.top = '0px'; gridOverlay.style.backgroundPosition = `${DATE_COL_PX}px 0`
    inner.querySelectorAll('.strong').forEach(n=>n.remove())
    for(let h=0; h<=HOURS; h+=6){
      const m = document.createElement('div'); m.className='strong'; m.style.position='absolute'; m.style.left=(DATE_COL_PX + h*HOUR_PX)+'px'; m.style.top='0'; m.style.width='2px'; m.style.height=trackHeight+'px'; m.style.background=strong; m.style.pointerEvents='none'; inner.appendChild(m)
    }
  }

  /* RENDER EVENTS (multi-day split as before) */
  function renderEvents(){
    inner.querySelectorAll('.event-block').forEach(n=>n.remove())
    const items = load().filter(i => i.due)
    items.forEach(it => {
      const start = new Date(it.due)
      const durationMin = it.duration ? Number(it.duration) : 30
      let remaining = durationMin
      let current = new Date(start)
      const MAX_DAYS_SPLIT = 14
      let splits = 0
      while(remaining > 0 && splits < MAX_DAYS_SPLIT){
        const dayKey = toKey(current)
        const dayIndex = DATE_RANGE.findIndex(d => d.key === dayKey)
        const endOfDay = new Date(current); endOfDay.setHours(24,0,0,0)
        const minsUntilMidnight = Math.round((endOfDay - current) / 60000)
        const thisPart = Math.min(remaining, minsUntilMidnight > 0 ? minsUntilMidnight : remaining)
        if(dayIndex >= 0){
          const minutesFromMidnight = current.getHours()*60 + current.getMinutes()
          const leftInside = DATE_COL_PX + (minutesFromMidnight/60)*HOUR_PX
          const widthPx = Math.max(12, (thisPart/60)*HOUR_PX)
          const el = document.createElement('div'); el.className='event-block'; el.dataset.id = it.id
          el.style.left = Math.round(leftInside) + 'px'
          el.style.top = (HEADER_H + dayIndex*DAY_H + 8) + 'px'
          el.style.width = Math.round(Math.max(8, widthPx - 6)) + 'px'
          el.style.background = it.completed ? '#9aa6b4' : colorFor(it)
          if(it.completed) el.classList.add('completed')
          el.textContent = it.name
          el.title = (it.description?it.description+' — ':'') + new Date(it.due).toLocaleString()
          el.addEventListener('click', (e)=>{ e.stopPropagation(); timelineClickHandler(it.id) })
          inner.appendChild(el)
        }
        remaining -= thisPart
        current = new Date(current)
        current.setDate(current.getDate() + 1)
        current.setHours(0,0,0,0)
        splits++
      }
    })
  }

  /* Timeline click: toggle completed or delete (if completed) */
  function timelineClickHandler(id){
    const items = load()
    const it = items.find(x=>x.id===id)
    if(!it) return
    if(it.completed){
      if(confirm('This agenda is already completed. Remove it?')){ deleteItem(id) }
    } else {
      toggleCompleted(id)
    }
  }

  /* TODO list rendering with nicer icon buttons */
  function todoSort(a,b){
    if(!!a.priority !== !!b.priority) return a.priority ? -1 : 1
    const ad = a.due ? new Date(a.due).getTime() : Infinity
    const bd = b.due ? new Date(b.due).getTime() : Infinity
    return ad - bd
  }
  function renderTodoList(){
    const items = load().slice().sort(todoSort)
    todoList.innerHTML = ''
    if(!items.length){ todoList.innerHTML = '<div style="padding:12px;color:var(--muted)">Nothing left to do!</div>'; return }
    items.forEach(it => {
      const el = document.createElement('div'); el.className='todo-item'; el.dataset.id = it.id
      if(it.completed) el.classList.add('completed')
      const left = document.createElement('div'); left.className='todo-left'
      const head = document.createElement('div'); head.className='todo-head'
      const dot = document.createElement('div'); dot.className='dot'; dot.style.background = colorFor(it)
      const title = document.createElement('div'); title.className='todo-title'; title.textContent = it.name
      head.appendChild(dot); head.appendChild(title)
      const meta = document.createElement('div'); meta.className='todo-meta'; meta.textContent = it.due ? new Date(it.due).toLocaleString() : 'Unscheduled'
      left.appendChild(head); left.appendChild(meta)
      const right = document.createElement('div'); right.style.display='flex'; right.style.gap='8px'; right.style.alignItems='center'
      const doneBtn = document.createElement('button'); doneBtn.className='icon-btn done'; doneBtn.title = it.completed ? 'Undo' : 'Mark done'
      doneBtn.innerHTML = it.completed ? undoIcon() : checkIcon()
      doneBtn.addEventListener('click', (ev)=>{ ev.stopPropagation(); toggleCompleted(it.id) })
      const delBtn = document.createElement('button'); delBtn.className='icon-btn delete'; delBtn.title='Delete'; delBtn.innerHTML = trashIcon()
      delBtn.addEventListener('click', (ev)=>{ ev.stopPropagation(); if(confirm('Delete this agenda?')) deleteItem(it.id) })
      right.appendChild(doneBtn); right.appendChild(delBtn)
      el.appendChild(left); el.appendChild(right)
      el.addEventListener('click', ()=> showDetails(it.id))
      todoList.appendChild(el)
    })
  }

  function renderTodoList(){
    const items = load().slice().sort(todoSort)
    todoList.innerHTML = ''
    if(!items.length){
      // friendly placeholder when empty
      const placeholder = document.createElement('div')
      placeholder.style.padding = '12px'
      placeholder.style.color = 'var(--muted)'
      placeholder.style.textAlign = 'center'
      placeholder.style.fontWeight = '700'
      placeholder.textContent = 'Nothing left to do!'
      todoList.appendChild(placeholder)
      return
    }
    items.forEach(it => {
      const el = document.createElement('div'); el.className='todo-item'; el.dataset.id = it.id
      if(it.completed) el.classList.add('completed')
      const left = document.createElement('div'); left.className='todo-left'
      const head = document.createElement('div'); head.className='todo-head'
      const dot = document.createElement('div'); dot.className='dot'; dot.style.background = colorFor(it)
      const title = document.createElement('div'); title.className='todo-title'; title.textContent = it.name
      head.appendChild(dot); head.appendChild(title)
      const meta = document.createElement('div'); meta.className='todo-meta'; meta.textContent = it.due ? new Date(it.due).toLocaleString() : 'Unscheduled'
      left.appendChild(head); left.appendChild(meta)
      const right = document.createElement('div'); right.style.display='flex'; right.style.gap='8px'; right.style.alignItems='center'
      const doneBtn = document.createElement('button'); doneBtn.className='icon-btn done'; doneBtn.title = it.completed ? 'Undo' : 'Mark done'
      doneBtn.innerHTML = it.completed ? undoIcon() : checkIcon()
      doneBtn.addEventListener('click', (ev)=>{ ev.stopPropagation(); toggleCompleted(it.id) })
      const delBtn = document.createElement('button'); delBtn.className='icon-btn delete'; delBtn.title='Delete'; delBtn.innerHTML = trashIcon()
      delBtn.addEventListener('click', (ev)=>{ ev.stopPropagation(); if(confirm('Delete this agenda?')) deleteItem(it.id) })
      right.appendChild(doneBtn); right.appendChild(delBtn)
      el.appendChild(left); el.appendChild(right)
      el.addEventListener('click', ()=> showDetails(it.id))
      todoList.appendChild(el)
    })
  }



  /* CRUD functions */
  function addItem(obj){ const items = load(); const it = { id: uid(), name: obj.name, description: obj.description||'', duration: obj.duration?Number(obj.duration):null, type: obj.type||'other', due: obj.due||null, priority: !!obj.priority, completed:false, created_at: new Date().toISOString() }; items.push(it); save(items); refreshAll() }
  function deleteItem(id){ const items = load().filter(x=>x.id!==id); save(items); closeModalIfOpen(id); refreshAll() }
  function toggleCompleted(id){ const items = load(); const it = items.find(x=>x.id===id); if(!it) return; it.completed = !it.completed; save(items); refreshAll() }
  function updateItem(id, patch){ const items = load(); const idx = items.findIndex(x=>x.id===id); if(idx<0) return; items[idx] = {...items[idx], ...patch}; save(items); refreshAll() }

  /* FORM wiring */
  function initStartNow(){ const now=new Date(); now.setSeconds(0,0); const roundTo = 5*60*1000; const r=new Date(Math.ceil(now.getTime()/roundTo)*roundTo); startEl.value = r.toISOString().slice(0,16) }
  initStartNow()
  addBtn.addEventListener('click', ()=>{
    const name = nameEl.value.trim(); if(!name){ alert('Please enter a name'); return }
    const duration = durationEl.value ? Number(durationEl.value) : null
    let due = null
    if(startEl.value){ const dt = new Date(startEl.value); due = dt.toISOString() }
    addItem({ name, description: descEl.value.trim(), duration, type: typeEl.value, due, priority: !!priorityInput.checked })
    nameEl.value=''; descEl.value=''; durationEl.value=''; priorityInput.checked=false; initStartNow()
  })
  clearBtn.addEventListener('click', ()=>{ nameEl.value=''; descEl.value=''; durationEl.value=''; priorityInput.checked=false; initStartNow() })

  /* KEYBOARD NAV and scroll clamping */
  function setupKeyboardNav(){
    viewport.addEventListener('keydown', (e)=>{
      const stepX = Math.round(HOUR_PX/2), stepY = Math.round(DAY_H/2)
      switch(e.key){
        case 'ArrowLeft': viewport.scrollBy({ left:-stepX, behavior:'smooth' }); e.preventDefault(); break
        case 'ArrowRight': viewport.scrollBy({ left:stepX, behavior:'smooth' }); e.preventDefault(); break
        case 'ArrowUp': viewport.scrollBy({ top:-stepY, behavior:'smooth' }); e.preventDefault(); break
        case 'ArrowDown': viewport.scrollBy({ top:stepY, behavior:'smooth' }); e.preventDefault(); break
        case 'Home': viewport.scrollTo({ left:0, top:0, behavior:'smooth' }); e.preventDefault(); break
        case 'End': viewport.scrollTo({ left: inner.scrollWidth, top: inner.scrollHeight, behavior:'smooth' }); e.preventDefault(); break
      }
    })
    viewport.tabIndex = 0
  }
  let clampPending = false
  function clampScroll(){
    if(clampPending) return
    clampPending = true
    requestAnimationFrame(()=>{ clampPending = false; const maxLeft = Math.max(0, inner.scrollWidth - viewport.clientWidth); const maxTop = Math.max(0, inner.scrollHeight - viewport.clientHeight); if(viewport.scrollLeft<0) viewport.scrollLeft=0; if(viewport.scrollLeft>maxLeft) viewport.scrollLeft=maxLeft; if(viewport.scrollTop<0) viewport.scrollTop=0; if(viewport.scrollTop>maxTop) viewport.scrollTop=maxTop })
  }
  viewport.addEventListener('scroll', clampScroll)
  viewport.addEventListener('wheel', (e)=>{ if(Math.abs(e.deltaX)>0.5) return; if(e.shiftKey || e.ctrlKey){ viewport.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive:false })

  /* Modal functions (same as previous behavior) */
  let modalOpenId = null
  function showDetails(id){
    const it = load().find(x=>x.id===id); if(!it) return
    modalOpenId = id
    modalTitle.textContent = 'Agenda details'
    modalBody.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-weight:800;font-size:16px">${escapeHtml(it.name)}</div>
      </div>
      <div style="margin-top:8px;color:var(--muted)">${it.due ? new Date(it.due).toLocaleString() : 'Unscheduled'}</div>
      <div style="margin-top:12px;font-size:14px">${it.description ? escapeHtml(it.description).replace(/\n/g,'<br>') : '<span style="color:var(--muted)">No description</span>'}</div>
      <div style="margin-top:12px;color:var(--muted);font-size:13px">Type: ${escapeHtml(it.type)} • Duration: ${it.duration?it.duration+' min':'—'}</div>
    `
    modalFooter.innerHTML = ''
    const closeBtn = document.createElement('button'); closeBtn.className='close-btn'; closeBtn.textContent='Close'; closeBtn.addEventListener('click', closeModal)
    const modifyBtn = document.createElement('button'); modifyBtn.className='save-btn'; modifyBtn.textContent='Modify'; modifyBtn.addEventListener('click', ()=> openEditForm(id))
    modalFooter.appendChild(closeBtn)
    modalFooter.appendChild(modifyBtn)
    openModal()
  }
  function openEditForm(id){
    const it = load().find(x=>x.id===id); if(!it) return
    modalTitle.textContent = 'Edit agenda'; modalBody.innerHTML = ''
    const form = document.createElement('div')
    form.innerHTML = `
      <div class="field"><label class="label">Name</label><input id="m_name" type="text" value="${escapeAttr(it.name)}"/></div>
      <div class="field" style="margin-top:8px"><label class="label">Description</label><textarea id="m_desc">${escapeAttr(it.description||'')}</textarea></div>
      <div class="inline" style="margin-top:8px">
        <div style="flex:1"><label class="label">Duration (mins)</label><input id="m_duration" type="number" value="${it.duration?it.duration:''}" /></div>
        <div style="width:140px"><label class="label">Type</label>
          <select id="m_type">
            <option value="work" ${it.type==='work'?'selected':''}>Work</option>
            <option value="personal" ${it.type==='personal'?'selected':''}>Personal</option>
            <option value="other" ${it.type==='other'?'selected':''}>Other</option>
          </select>
        </div>
      </div>
      <div class="inline" style="margin-top:8px">
        <div style="flex:1"><label class="label">Start time (optional)</label><input id="m_start" type="datetime-local" value="${it.due?new Date(it.due).toISOString().slice(0,16):''}" /></div>
        <div style="width:140px"><label class="label">Priority</label><div style="display:flex;align-items:center;gap:8px"><input id="m_prio" type="checkbox" ${it.priority?'checked':''} /></div></div>
      </div>
    `
    modalBody.appendChild(form)
    modalFooter.innerHTML = ''
    const closeBtn = document.createElement('button'); closeBtn.className='close-btn'; closeBtn.textContent='Close'; closeBtn.addEventListener('click', closeModal)
    const saveBtn = document.createElement('button'); saveBtn.className='save-btn'; saveBtn.textContent='Save'; saveBtn.addEventListener('click', ()=>{
      const patch = {
        name: document.getElementById('m_name').value.trim(),
        description: document.getElementById('m_desc').value.trim(),
        duration: document.getElementById('m_duration').value ? Number(document.getElementById('m_duration').value) : null,
        type: document.getElementById('m_type').value,
        priority: !!document.getElementById('m_prio').checked,
        due: document.getElementById('m_start').value ? new Date(document.getElementById('m_start').value).toISOString() : null
      }
      if(!patch.name){ alert('Name is required'); return }
      updateItem(id, patch)
      closeModal()
    })
    modalFooter.appendChild(closeBtn)
    modalFooter.appendChild(saveBtn)
  }
  function openModal(){ modalBackdrop.style.display = 'flex' }
  function closeModal(){ modalBackdrop.style.display = 'none'; modalOpenId = null }
  function closeModalIfOpen(itemId){ if(modalOpenId === itemId) closeModal() }
  modalBackdrop.addEventListener('click', (e)=>{ if(e.target === modalBackdrop) closeModal() })

  /* UTILS */
  function escapeHtml(s){ return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;') }
  function escapeAttr(s){ return String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;') }

  /* NOW display + now-line functions */
  function updateNowDisplays(){
    const now = new Date()
    const big = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const small = now.toLocaleString()
    if(nowBig) nowBig.textContent = big
    if(nowSmall) nowSmall.textContent = small
  }
  function updateNowLine(){
    ensureNowLine()
    const now = new Date()
    const todayKey = toKey(now)
    const idx = DATE_RANGE.findIndex(d => d.key === todayKey)
    if(idx < 0){
      nowLine.style.display = 'none'
      return
    }
    const minutes = now.getHours()*60 + now.getMinutes() + (now.getSeconds()/60)
    const left = DATE_COL_PX + (minutes/60) * HOUR_PX
    const { trackWidth, trackHeight } = computeSizes()
    if(left < DATE_COL_PX || left > trackWidth) { nowLine.style.display = 'none'; return }
    nowLine.style.display = 'block'
    nowLine.style.left = Math.round(left) + 'px'
    nowLine.style.top = '0px'
    nowLine.style.height = trackHeight + 'px'
  }

  /* RENDER ALL */

  function refreshAll(){
    // Save the exact pixel scroll position before rebuild
    const prevScrollLeft = viewport.scrollLeft || 0;
    const prevScrollTop = viewport.scrollTop || 0;
    const hadAnyScroll = prevScrollLeft !== 0 || prevScrollTop !== 0;

    // Rebuild date range & layout
    DATE_RANGE = buildDateRange();
    const { trackWidth, trackHeight } = computeSizes();
    buildHours(trackWidth);
    buildDayRows(trackWidth);
    buildGridOverlay(trackWidth, trackHeight);
    renderEvents();
    renderTodoList();
    ensureNowLine();
    updateNowDisplays();
    updateNowLine();
    setupKeyboardNav();

    // Restore previous exact pixel scroll (in next frame after DOM/layout updates)
    requestAnimationFrame(() => {
      // If user had scrolled previously, restore previous pixel offsets (clamped).
      // Otherwise keep default behavior: focus today (only on first/no-scroll).
      const maxLeft = Math.max(0, inner.scrollWidth - viewport.clientWidth);
      const maxTop = Math.max(0, inner.scrollHeight - viewport.clientHeight);

      if(hadAnyScroll){
        // restore exactly, but clamp to valid range
        viewport.scrollLeft = Math.max(0, Math.min(prevScrollLeft, maxLeft));
        viewport.scrollTop  = Math.max(0, Math.min(prevScrollTop,  maxTop));
      } else {
        // no previous scroll — preserve original "focus today" behavior
        const todayKey = (new Date()).toISOString().slice(0,10);
        const idx = DATE_RANGE.findIndex(d => d.key === todayKey);
        viewport.scrollTop = idx>=0 ? Math.max(0, HEADER_H + idx*DAY_H - 8) : 0;
        // keep viewport.scrollLeft unchanged (user hasn't panned horizontally yet)
      }

      // final clamp as safety
      clampScroll();
    });
  }



  /* ICONS */
  function checkIcon(){ return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>` }
  function undoIcon(){ return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 7a9 9 0 1 0 0 10"/></svg>` }
  function trashIcon(){ return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>` }

  /* BINDINGS & INIT */
  setupKeyboardNav()
  // update big clock every second
  setInterval(updateNowDisplays, 1000)
  // update now-line every 30s
  setInterval(updateNowLine, 30000)
  refreshAll()
  window.addEventListener('resize', ()=> { HOUR_PX = (function(){ const v = getComputedStyle(document.documentElement).getPropertyValue('--hour-px'); const n = parseInt(v); return isNaN(n) ? 86 : n; })(); requestAnimationFrame(refreshAll) })
})
