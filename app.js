/* Word Smart — Dad vs. George
 * Two modes: Duel (turn-based first-to-N) and Beat-the-Clock (60s solo, compare).
 */
(() => {
  "use strict";

  // ---------- Storage ----------
  const LS = {
    p1:        "ws_p1_name",
    p2:        "ws_p2_name",
    target:    "ws_duel_target",
    mode:      "ws_last_mode",
    custom:    "ws_custom_words",
    customOnly:"ws_use_custom_only",
    history:   "ws_history",
  };
  const get = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const getJSON = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
  const setJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  // ---------- Word pool ----------
  function loadWordPool() {
    const custom = getJSON(LS.custom, []);
    const useCustomOnly = get(LS.customOnly, "0") === "1";
    if (useCustomOnly && custom.length >= 4) return custom.slice();
    if (useCustomOnly) return STARTER_WORDS.slice(); // not enough custom, fall back
    // Merge; dedupe by word
    const seen = new Set();
    const out = [];
    for (const w of [...custom, ...STARTER_WORDS]) {
      const key = (w.word || "").trim().toLowerCase();
      if (!key || !w.def || seen.has(key)) continue;
      seen.add(key);
      out.push({ word: w.word.trim(), def: w.def.trim() });
    }
    return out;
  }

  // ---------- Utility ----------
  const $ = (id) => document.getElementById(id);
  function shuffle(a) { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; }
  function pickN(arr, n, exclude) {
    const filtered = arr.filter(x => x !== exclude);
    return shuffle(filtered).slice(0, n);
  }

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("screen--active"));
    $(id).classList.add("screen--active");
  }

  // ---------- Question generator ----------
  // Returns: { word, correctDef, choices: [4 strings, shuffled] }
  function makeQuestion(pool, recentWords) {
    const candidates = pool.filter(w => !recentWords.includes(w.word));
    const source = candidates.length >= 4 ? candidates : pool;
    const correct = source[Math.floor(Math.random() * source.length)];
    const distractors = pickN(pool, 3, correct).map(w => w.def);
    const choices = shuffle([correct.def, ...distractors]);
    return { word: correct.word, correctDef: correct.def, choices };
  }

  // ---------- Setup screen ----------
  const setup = {
    mode: get(LS.mode, "duel"),
    target: parseInt(get(LS.target, "10"), 10),
  };

  function initSetup() {
    $("name1").value = get(LS.p1, "Dad");
    $("name2").value = get(LS.p2, "George");
    // Mode
    document.querySelectorAll(".mode").forEach(b => {
      b.classList.toggle("mode--active", b.dataset.mode === setup.mode);
      b.addEventListener("click", () => {
        setup.mode = b.dataset.mode;
        set(LS.mode, setup.mode);
        document.querySelectorAll(".mode").forEach(x => x.classList.toggle("mode--active", x === b));
        $("duel-options").style.display = setup.mode === "duel" ? "flex" : "none";
      });
    });
    $("duel-options").style.display = setup.mode === "duel" ? "flex" : "none";
    // Target
    document.querySelectorAll(".target").forEach(b => {
      const t = parseInt(b.dataset.target, 10);
      b.classList.toggle("target--active", t === setup.target);
      b.addEventListener("click", () => {
        setup.target = t;
        set(LS.target, String(t));
        document.querySelectorAll(".target").forEach(x => x.classList.toggle("target--active", x === b));
      });
    });

    $("btn-start").addEventListener("click", startMatch);
    $("btn-edit-words").addEventListener("click", openEditor);

    updateWordCount();
    renderRecent();
  }

  function updateWordCount() {
    const pool = loadWordPool();
    const custom = getJSON(LS.custom, []).length;
    $("word-count").textContent =
      `Word pool: ${pool.length} words${custom ? ` · ${custom} custom` : " · add your own via Edit word list"}`;
  }

  // ---------- History ----------
  function pushHistory(entry) {
    const list = getJSON(LS.history, []);
    list.unshift(entry);
    setJSON(LS.history, list.slice(0, 8));
  }

  function renderRecent() {
    const list = getJSON(LS.history, []);
    const sec = $("recent-section");
    const ul = $("recent-list");
    if (!list.length) { sec.hidden = true; return; }
    sec.hidden = false;
    ul.innerHTML = "";
    for (const e of list) {
      const li = document.createElement("li");
      const left = document.createElement("span");
      const mode = e.mode === "duel" ? "Duel" : "Clock";
      left.innerHTML = `<span class="who">${escapeHtml(e.winner)}</span> beat ${escapeHtml(e.loser)} — ${mode} ${e.score1}–${e.score2}`;
      const right = document.createElement("span");
      right.className = "when";
      right.textContent = relTime(e.ts);
      li.appendChild(left); li.appendChild(right);
      ul.appendChild(li);
    }
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c])); }
  function relTime(ts) {
    const diff = (Date.now() - ts) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  // ---------- Match start ----------
  function startMatch() {
    const n1 = ($("name1").value.trim() || "Player 1").slice(0, 14);
    const n2 = ($("name2").value.trim() || "Player 2").slice(0, 14);
    set(LS.p1, n1); set(LS.p2, n2);
    if (setup.mode === "duel") startDuel(n1, n2, setup.target);
    else startClockRound1(n1, n2);
  }

  // ============================================================
  // DUEL MODE
  // ============================================================
  const duel = {
    n1: "", n2: "", target: 10,
    s1: 0, s2: 0, streak1: 0, streak2: 0,
    turn: 1, recent: [], pool: [],
    locked: false,
  };

  function startDuel(n1, n2, target) {
    duel.n1 = n1; duel.n2 = n2; duel.target = target;
    duel.s1 = 0; duel.s2 = 0; duel.streak1 = 0; duel.streak2 = 0;
    duel.turn = Math.random() < 0.5 ? 1 : 2;
    duel.recent = [];
    duel.pool = loadWordPool();
    duel.locked = false;
    $("p1-name").textContent = n1;
    $("p2-name").textContent = n2;
    $("target-mid").textContent = `first to ${target}`;
    renderDuelScores();
    showScreen("screen-duel");
    nextDuelQuestion();
    $("duel-quit").onclick = () => { if (confirm("Quit this match?")) showScreen("screen-setup"); };
  }

  function renderDuelScores() {
    $("p1-score").textContent = duel.s1;
    $("p2-score").textContent = duel.s2;
    $("p1-streak").textContent = duel.streak1 >= 2 ? `🔥 ${duel.streak1} streak` : "";
    $("p2-streak").textContent = duel.streak2 >= 2 ? `🔥 ${duel.streak2} streak` : "";
    $("p1-card").classList.toggle("active", duel.turn === 1);
    $("p2-card").classList.toggle("active", duel.turn === 2);
    $("turn-banner").textContent = `${duel.turn === 1 ? duel.n1 : duel.n2}'s turn`;
  }

  function nextDuelQuestion() {
    duel.locked = false;
    const q = makeQuestion(duel.pool, duel.recent);
    duel.recent.push(q.word);
    if (duel.recent.length > Math.min(40, Math.floor(duel.pool.length / 2))) duel.recent.shift();
    $("duel-word").textContent = q.word;
    $("duel-feedback").textContent = "";
    $("duel-feedback").className = "feedback";
    const answers = $("duel-answers");
    answers.innerHTML = "";
    q.choices.forEach(c => {
      const b = document.createElement("button");
      b.className = "answer";
      b.textContent = c;
      b.addEventListener("click", () => duelAnswer(b, c, q.correctDef));
      answers.appendChild(b);
    });
  }

  function duelAnswer(btn, choice, correctDef) {
    if (duel.locked) return;
    duel.locked = true;
    const correct = choice === correctDef;
    document.querySelectorAll("#duel-answers .answer").forEach(b => {
      b.disabled = true;
      if (b.textContent === correctDef) b.classList.add("right");
    });
    if (!correct) btn.classList.add("wrong");

    if (correct) {
      if (duel.turn === 1) { duel.s1++; duel.streak1++; }
      else                 { duel.s2++; duel.streak2++; }
      const streak = duel.turn === 1 ? duel.streak1 : duel.streak2;
      const bonus = streak >= 3 ? " 🔥" : "";
      $("duel-feedback").textContent = `Correct! +1${bonus}`;
      $("duel-feedback").className = "feedback good";
    } else {
      if (duel.turn === 1) duel.streak1 = 0; else duel.streak2 = 0;
      $("duel-feedback").textContent = `Nope — turn passes.`;
      $("duel-feedback").className = "feedback bad";
    }
    renderDuelScores();

    setTimeout(() => {
      if (duel.s1 >= duel.target || duel.s2 >= duel.target) return finishDuel();
      if (!correct) duel.turn = duel.turn === 1 ? 2 : 1;
      renderDuelScores();
      nextDuelQuestion();
    }, correct ? 900 : 1400);
  }

  function finishDuel() {
    const p1won = duel.s1 > duel.s2;
    const winner = p1won ? duel.n1 : duel.n2;
    const loser  = p1won ? duel.n2 : duel.n1;
    const sW = Math.max(duel.s1, duel.s2);
    const sL = Math.min(duel.s1, duel.s2);
    pushHistory({ mode: "duel", winner, loser, score1: sW, score2: sL, ts: Date.now() });
    showResult({
      eyebrow: "Duel over",
      headline: `🏆 ${winner} wins!`,
      scores: [
        { name: duel.n1, num: duel.s1, win: p1won },
        { name: duel.n2, num: duel.s2, win: !p1won },
      ],
      detail: `First to ${duel.target} · ${winner} took it ${sW}–${sL}.`,
    });
  }

  // ============================================================
  // BEAT-THE-CLOCK MODE
  // ============================================================
  const clock = {
    n1: "", n2: "", queue: [],
    round: 1, idx: 0, score: 0, timeLeft: 60,
    s1: 0, s2: 0, timer: null, locked: false, pool: [],
  };

  function buildQuestionQueue(pool, target = 80) {
    const out = [];
    const used = [];
    const words = shuffle(pool);
    for (const w of words) {
      const distractors = pickN(pool, 3, w).map(x => x.def);
      out.push({
        word: w.word,
        correctDef: w.def,
        choices: shuffle([w.def, ...distractors]),
      });
      if (out.length >= target) break;
    }
    return out;
  }

  function startClockRound1(n1, n2) {
    clock.n1 = n1; clock.n2 = n2;
    clock.pool = loadWordPool();
    clock.queue = buildQuestionQueue(clock.pool, 120);
    clock.round = 1;
    clock.s1 = 0; clock.s2 = 0;
    showHandoff({
      eyebrow: "Beat the Clock",
      title: `${n1}, you're up first`,
      detail: `60 seconds. Tap the right definition. Wrong answers don't deduct — but a new word costs a tap. Ready?`,
      next: () => playClockRound(),
    });
  }

  function playClockRound() {
    const me = clock.round === 1 ? clock.n1 : clock.n2;
    $("clock-player").textContent = me;
    clock.idx = 0; clock.score = 0; clock.timeLeft = 60; clock.locked = false;
    $("clock-score").textContent = "0";
    $("clock-timer").textContent = "60";
    $("clock-timer").classList.remove("low");
    showScreen("screen-clock");
    nextClockQuestion();
    clock.timer = setInterval(() => {
      clock.timeLeft--;
      $("clock-timer").textContent = String(clock.timeLeft);
      if (clock.timeLeft <= 10) $("clock-timer").classList.add("low");
      if (clock.timeLeft <= 0) endClockRound();
    }, 1000);
    $("clock-quit").onclick = () => {
      if (confirm("Quit this match?")) { clearInterval(clock.timer); showScreen("screen-setup"); }
    };
  }

  function nextClockQuestion() {
    clock.locked = false;
    if (clock.idx >= clock.queue.length) clock.queue = clock.queue.concat(buildQuestionQueue(clock.pool, 60));
    const q = clock.queue[clock.idx++];
    $("clock-word").textContent = q.word;
    $("clock-feedback").textContent = "";
    $("clock-feedback").className = "feedback";
    const answers = $("clock-answers");
    answers.innerHTML = "";
    q.choices.forEach(c => {
      const b = document.createElement("button");
      b.className = "answer";
      b.textContent = c;
      b.addEventListener("click", () => clockAnswer(b, c, q.correctDef));
      answers.appendChild(b);
    });
  }

  function clockAnswer(btn, choice, correctDef) {
    if (clock.locked) return;
    clock.locked = true;
    const correct = choice === correctDef;
    document.querySelectorAll("#clock-answers .answer").forEach(b => {
      b.disabled = true;
      if (b.textContent === correctDef) b.classList.add("right");
    });
    if (!correct) btn.classList.add("wrong");
    if (correct) {
      clock.score++;
      $("clock-score").textContent = String(clock.score);
      $("clock-feedback").textContent = "+1";
      $("clock-feedback").className = "feedback good";
    } else {
      $("clock-feedback").textContent = "Nope";
      $("clock-feedback").className = "feedback bad";
    }
    setTimeout(() => { if (clock.timeLeft > 0) nextClockQuestion(); }, correct ? 350 : 650);
  }

  function endClockRound() {
    clearInterval(clock.timer);
    if (clock.round === 1) {
      clock.s1 = clock.score;
      clock.round = 2;
      showHandoff({
        eyebrow: `${clock.n1} scored ${clock.s1}`,
        title: `${clock.n2}, your turn`,
        detail: `Same rules — 60 seconds, beat ${clock.s1} to win.`,
        next: () => playClockRound(),
      });
    } else {
      clock.s2 = clock.score;
      finishClock();
    }
  }

  function finishClock() {
    const tied = clock.s1 === clock.s2;
    const p1won = clock.s1 > clock.s2;
    const winner = tied ? "Tie" : (p1won ? clock.n1 : clock.n2);
    const loser  = tied ? "" : (p1won ? clock.n2 : clock.n1);
    if (!tied) pushHistory({ mode: "clock", winner, loser, score1: Math.max(clock.s1, clock.s2), score2: Math.min(clock.s1, clock.s2), ts: Date.now() });
    showResult({
      eyebrow: "Beat the Clock — final",
      headline: tied ? "🤝 It's a tie!" : `🏆 ${winner} wins!`,
      scores: [
        { name: clock.n1, num: clock.s1, win: !tied && p1won },
        { name: clock.n2, num: clock.s2, win: !tied && !p1won },
      ],
      detail: tied ? `Both scored ${clock.s1}. Run it back?` : `${winner} beat ${loser} ${Math.max(clock.s1, clock.s2)}–${Math.min(clock.s1, clock.s2)}.`,
    });
  }

  // ============================================================
  // Handoff screen
  // ============================================================
  function showHandoff({ eyebrow, title, detail, next }) {
    $("handoff-eyebrow").textContent = eyebrow;
    $("handoff-title").textContent = title;
    $("handoff-detail").textContent = detail;
    $("handoff-go").onclick = next;
    showScreen("screen-handoff");
  }

  // ============================================================
  // Result screen
  // ============================================================
  function showResult({ eyebrow, headline, scores, detail }) {
    $("result-eyebrow").textContent = eyebrow;
    $("result-headline").textContent = headline;
    $("result-detail").textContent = detail;
    const sc = $("result-scores");
    sc.innerHTML = "";
    scores.forEach(s => {
      const div = document.createElement("div");
      div.className = "result-score" + (s.win ? " win" : "");
      div.innerHTML = `<div class="rs-name">${escapeHtml(s.name)}</div><div class="rs-num">${s.num}</div>`;
      sc.appendChild(div);
    });
    showScreen("screen-result");
    if (headline.startsWith("🏆")) launchConfetti();
    $("btn-rematch").onclick = () => {
      if (setup.mode === "duel") startDuel(duel.n1 || clock.n1, duel.n2 || clock.n2, duel.target || setup.target);
      else startClockRound1(clock.n1, clock.n2);
    };
    $("btn-home").onclick = () => { renderRecent(); updateWordCount(); showScreen("screen-setup"); };
  }

  // ---------- Confetti ----------
  function launchConfetti() {
    const c = $("confetti");
    const ctx = c.getContext("2d");
    c.width = window.innerWidth; c.height = window.innerHeight;
    const colors = ["#fa5400", "#38bdf8", "#34d399", "#fbbf24", "#a78bfa", "#ff5dd2"];
    const parts = [];
    for (let i = 0; i < 140; i++) parts.push({
      x: Math.random() * c.width,
      y: -20 - Math.random() * 200,
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 3,
      r: 4 + Math.random() * 4,
      col: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.2,
    });
    let frames = 0;
    function step() {
      ctx.clearRect(0, 0, c.width, c.height);
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.rot += p.vrot;
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.col;
        ctx.fillRect(-p.r, -p.r * 0.4, p.r * 2, p.r * 0.8);
        ctx.restore();
      }
      frames++;
      if (frames < 240) requestAnimationFrame(step);
      else ctx.clearRect(0, 0, c.width, c.height);
    }
    step();
  }

  // ============================================================
  // Word list editor
  // ============================================================
  function openEditor() {
    const ta = $("editor-textarea");
    const custom = getJSON(LS.custom, []);
    ta.value = custom.map(w => `${w.word}: ${w.def}`).join("\n");
    $("editor-custom-only").checked = get(LS.customOnly, "0") === "1";
    refreshEditorStats(custom.length);
    $("editor-modal").hidden = false;
  }
  function refreshEditorStats(count) {
    $("editor-stats").textContent = `${count} custom word${count === 1 ? "" : "s"} saved · starter pack: ${STARTER_WORDS.length} words`;
  }
  function parseEditor(text) {
    const out = [];
    const seen = new Set();
    const lines = text.split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      // Accept colon, em/en dash, hyphen with spaces, or tab as separator
      const m = line.match(/^(.+?)\s*(?:[:\t]|[—–]|\s-\s)\s*(.+)$/);
      if (!m) continue;
      const word = m[1].trim();
      const def = m[2].trim();
      if (!word || !def) continue;
      const key = word.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ word, def });
    }
    return out;
  }
  function closeEditor() { $("editor-modal").hidden = true; }
  function bindEditor() {
    $("editor-close").onclick = closeEditor;
    $("editor-modal").addEventListener("click", e => { if (e.target.id === "editor-modal") closeEditor(); });
    $("editor-save").onclick = () => {
      const parsed = parseEditor($("editor-textarea").value);
      setJSON(LS.custom, parsed);
      set(LS.customOnly, $("editor-custom-only").checked ? "1" : "0");
      refreshEditorStats(parsed.length);
      updateWordCount();
      closeEditor();
    };
    $("editor-clear").onclick = () => {
      if (!confirm("Clear all custom words?")) return;
      setJSON(LS.custom, []);
      $("editor-textarea").value = "";
      set(LS.customOnly, "0");
      $("editor-custom-only").checked = false;
      refreshEditorStats(0);
      updateWordCount();
    };
  }

  // ---------- Init ----------
  document.addEventListener("DOMContentLoaded", () => {
    initSetup();
    bindEditor();
  });

})();
