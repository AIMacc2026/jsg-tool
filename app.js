(() => {
  const APP_VERSION = "1";
  const STORAGE_KEY = `jsg_auth_${APP_VERSION}`;

  // ---------- Basic error surfacing ----------
  window.onerror = (msg, src, line, col) => {
    const t = document.getElementById("authMsg");
    if (t) t.textContent = `JS-Fehler: ${msg} (${line}:${col})`;
  };
  window.onunhandledrejection = (e) => {
    const t = document.getElementById("authMsg");
    const m = (e && e.reason && e.reason.message) ? e.reason.message : String(e.reason || e);
    if (t) t.textContent = `Promise-Fehler: ${m}`;
  };

  // ---------- Supabase ----------
  const SUPABASE_URL = "https://ccyhlcwgphvyyazpmcnq.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_l3XkI9FMLP25WRwbqJaiPA_542-9zGS";

  const SB = window.Supabase || window.supabase || window.supabaseJs;
  if (!SB || typeof SB.createClient !== "function") {
    const t = document.getElementById("authMsg");
    if (t) t.textContent = "Supabase-Library nicht geladen (index.html Script-Reihenfolge prüfen).";
    throw new Error("Supabase UMD not loaded");
  }

  const supabase = SB.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storageKey: STORAGE_KEY,
      storage: window.localStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  // Cleanup old storage keys (avoid weird multi-instance behavior)
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith("jsg_auth_") && k !== STORAGE_KEY) localStorage.removeItem(k);
    }
  } catch (_) {}

  // ---------- Helpers ----------
  const el = (id) => document.getElementById(id);

  const setMsg = (target, text, ok = true) => {
    if (!target) return;
    target.textContent = text || "";
    target.style.color = ok ? "var(--muted)" : "var(--danger)";
  };

  const fillSelect = (selectEl, items, placeholder = "Bitte wählen…") => {
    if (!selectEl) return;
    selectEl.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = placeholder;
    selectEl.appendChild(opt0);

    for (const it of items) {
      const o = document.createElement("option");
      o.value = it.id;
      o.textContent = it.label;
      selectEl.appendChild(o);
    }
  };

  const wordsCount = (s) => (!s ? 0 : s.trim().split(/\s+/).filter(Boolean).length);

  // ---------- DOM refs ----------
  const authSection = el("authSection");
  const appSection = el("appSection");
  const resultsSection = el("resultsSection");

  const userLabel = el("userLabel");
  const logoutBtn = el("logoutBtn");
  const entryViewBtn = el("entryViewBtn");
  const resultsViewBtn = el("resultsViewBtn");

  const email = el("email");
  const password = el("password");
  const pwToggle = el("pwToggle");
  const loginBtn = el("loginBtn");
  const signupBtn = el("signupBtn");
  const authMsg = el("authMsg");
  const inviteCode = el("inviteCode");

  const datum = el("datum");
  const teamSelect = el("teamSelect");
  const playerSelect = el("playerSelect");
  const typSelect = el("typSelect");

  const attJa = el("attJa");
  const attNein = el("attNein");
  const excJa = el("excJa");
  const excNein = el("excNein");
  const grundWrap = el("grundWrap");
  const grundSelect = el("grundSelect");

  const flagSelect = el("flagSelect");
  const katWrap = el("katWrap");
  const katSelect = el("katSelect");
  const sevWrap = el("sevWrap");
  const sevSelect = el("sevSelect");
  const notizWrap = el("notizWrap");
  const notiz = el("notiz");

  const readySelect = el("readySelect");
  const readyGrund = el("readyGrund");

  const saveBtn = el("saveBtn");
  const nextBtn = el("nextBtn");
  const saveMsg = el("saveMsg");

  // Results UI
  const rangeSelect = el("rangeSelect");
  const resultsSummary = el("resultsSummary");
  const reasonsList = el("reasonsList");
  const chartAttendance = el("chartAttendance");
  const chartFlags = el("chartFlags");

  // ---------- State ----------
  const state = {
    anwesenheit: true,
    abgemeldet: false,
    config: { typen: [], gruende: [], kategorien: [] },
    teams: [],
    players: [],
  };

  // ---------- UI logic ----------
  const setActive = (btnTrue, btnFalse, value, okColor = true) => {
    if (!btnTrue || !btnFalse) return;
    btnTrue.classList.toggle("active", value === true);
    btnFalse.classList.toggle("active", value === false);
    btnTrue.classList.toggle(okColor ? "ok" : "bad", value === true);
    btnFalse.classList.toggle(okColor ? "bad" : "ok", value === false);
  };

  const updateAttendanceUI = () => {
    setActive(attJa, attNein, state.anwesenheit, true);

    if (state.anwesenheit) {
      state.abgemeldet = false;
      setActive(excJa, excNein, state.abgemeldet, true);
      grundWrap?.classList.add("hidden");
      if (grundSelect) grundSelect.value = "";
    } else {
      grundWrap?.classList.remove("hidden");
    }
  };

  const updateExcusedUI = () => {
    setActive(excJa, excNein, state.abgemeldet, true);
  };

  const updateFlagUI = () => {
    const f = flagSelect?.value || "none";
    const show = f !== "none";
    katWrap?.classList.toggle("hidden", !show);
    sevWrap?.classList.toggle("hidden", !show);
    notizWrap?.classList.toggle("hidden", !show);

    if (!show) {
      if (katSelect) katSelect.value = "";
      if (sevSelect) sevSelect.value = "";
      if (notiz) notiz.value = "";
    }
  };

  const showEntryView = () => {
    appSection?.classList.remove("hidden");
    resultsSection?.classList.add("hidden");
  };

  const showResultsView = async () => {
    appSection?.classList.add("hidden");
    resultsSection?.classList.remove("hidden");
    await loadResultsForSelection();
  };

  // ---------- Data loading ----------
  const loadConfig = async () => {
    const [typen, gruende, kategorien] = await Promise.all([
      supabase.from("config_trainingstypen").select("id,wert,sortierung").eq("aktiv", true).order("sortierung"),
      supabase.from("config_gruende").select("id,wert,sortierung").eq("aktiv", true).order("sortierung"),
      supabase.from("config_kategorien").select("id,wert,sortierung").eq("aktiv", true).order("sortierung"),
    ]);

    if (typen.error) throw typen.error;
    if (gruende.error) throw gruende.error;
    if (kategorien.error) throw kategorien.error;

    state.config.typen = (typen.data || []).map((x) => ({ id: x.id, label: x.wert }));
    state.config.gruende = (gruende.data || []).map((x) => ({ id: x.id, label: x.wert }));
    state.config.kategorien = (kategorien.data || []).map((x) => ({ id: x.id, label: x.wert }));

    fillSelect(typSelect, state.config.typen, "Trainingstyp wählen…");
    fillSelect(grundSelect, state.config.gruende, "Grund wählen…");
    fillSelect(katSelect, state.config.kategorien, "Kategorie wählen…");
  };

  const loadTeams = async () => {
    const { data, error } = await supabase.from("teams").select("id,name").eq("aktiv", true).order("name");
    if (error) throw error;

    state.teams = (data || []).map((x) => ({ id: x.id, label: x.name }));
    fillSelect(teamSelect, state.teams, "Team wählen…");

    // If current selection is invalid (after reload), reset to empty
    if (teamSelect && teamSelect.value && !state.teams.some((t) => t.id === teamSelect.value)) {
      teamSelect.value = "";
    }
  };

  const loadPlayersForTeam = async (teamId) => {
    // Always clear previous list FIRST to avoid stale 2010 list sticking around
    state.players = [];
    fillSelect(playerSelect, [], "Spieler wählen…");

    if (!teamId) return;

    const { data, error } = await supabase
      .from("team_memberships")
      .select("player_id, players:players(id,vorname,nachname,jahrgang,status)")
      .eq("team_id", teamId)
      .is("bis_datum", null);

    if (error) {
      // If query fails, keep list empty (don’t leave stale list)
      setMsg(saveMsg, `Spieler laden fehlgeschlagen: ${error.message}`, false);
      return;
    }

    const list = (data || [])
      .map((r) => r.players)
      .filter((p) => p && p.status === "aktiv")
      .map((p) => ({ id: p.id, label: `${p.vorname} ${p.nachname} ${p.jahrgang}` }))
      .sort((a, b) => a.label.localeCompare(b.label, "de"));

    state.players = list;
    fillSelect(playerSelect, list, list.length ? "Spieler wählen…" : "Keine Spieler im Team");
  };

  const refreshAppData = async () => {
    await loadConfig();
    await loadTeams();
    await loadPlayersForTeam(teamSelect?.value || "");
  };

  // ---------- Auth / session UI ----------
  const setSessionUI = async () => {
    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (!session) {
      authSection?.classList.remove("hidden");
      appSection?.classList.add("hidden");
      resultsSection?.classList.add("hidden");

      logoutBtn?.classList.add("hidden");
      entryViewBtn?.classList.add("hidden");
      resultsViewBtn?.classList.add("hidden");

      if (userLabel) userLabel.textContent = "Nicht angemeldet";
      return;
    }

    authSection?.classList.add("hidden");
    appSection?.classList.remove("hidden");
    resultsSection?.classList.add("hidden");

    logoutBtn?.classList.remove("hidden");
    entryViewBtn?.classList.remove("hidden");
    resultsViewBtn?.classList.remove("hidden");

    if (userLabel) userLabel.textContent = session.user.email || "Angemeldet";

    try {
      await refreshAppData();
    } catch (e) {
      setMsg(saveMsg, `Laden fehlgeschlagen: ${e.message}`, false);
    }
  };

  // ---------- Signup via /signup (invite-only) ----------
  const signup = async () => {
    setMsg(authMsg, "");

    const em = (email?.value || "").trim();
    const pw = password?.value || "";
    const code = (inviteCode?.value || "").trim();

    if (!em) return setMsg(authMsg, "E-Mail fehlt.", false);
    if (!pw) return setMsg(authMsg, "Passwort fehlt.", false);
    if (!code) return setMsg(authMsg, "Invite-Code fehlt.", false);

    try {
      if (signupBtn) {
        signupBtn.disabled = true;
        signupBtn.textContent = "Lädt…";
      }
      setMsg(authMsg, "Registrierung läuft…", true);

      const res = await fetch("/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em, password: pw, inviteCode: code }),
      });

      const raw = await res.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch (_) {}

      if (!res.ok || !data.ok) {
        const codeMsg = (data && (data.error || data.message)) ? (data.error || data.message) : "";
        if (codeMsg === "INVITE_INVALID") return setMsg(authMsg, "Invite-Code ist falsch.", false);
        if (codeMsg === "MISSING_FIELDS") return setMsg(authMsg, "E-Mail/Passwort/Invite-Code fehlt.", false);
        if (typeof codeMsg === "string" && codeMsg.toLowerCase().includes("already")) return setMsg(authMsg, "E-Mail ist bereits registriert.", false);
        if (typeof codeMsg === "string" && codeMsg.toLowerCase().includes("password")) return setMsg(authMsg, "Passwort erfüllt die Anforderungen nicht.", false);
        return setMsg(authMsg, "Registrieren fehlgeschlagen.", false);
      }

      setMsg(authMsg, "Konto erstellt. Bitte anmelden. Freischaltung durch Admin nötig.", true);
      if (password) password.value = "";
    } finally {
      if (signupBtn) {
        signupBtn.disabled = false;
        signupBtn.textContent = "Registrieren";
      }
    }
  };

  // ---------- Login / Logout ----------
  const login = async () => {
    try {
      setMsg(authMsg, "Anmeldung läuft…", true);
      loginBtn.disabled = true;
      loginBtn.textContent = "Lädt…";

      const em = (email?.value || "").trim();
      const pw = password?.value || "";

      if (!em) return setMsg(authMsg, "E-Mail fehlt.", false);
      if (!pw) return setMsg(authMsg, "Passwort fehlt.", false);

      const { error } = await supabase.auth.signInWithPassword({ email: em, password: pw });
      if (error) return setMsg(authMsg, error.message || "Anmeldung fehlgeschlagen.", false);

      setMsg(authMsg, "Angemeldet.", true);
      await setSessionUI();
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = "Anmelden";
    }
  };

  const logout = async () => {
    // UI sofort zurücksetzen
    authSection?.classList.remove("hidden");
    appSection?.classList.add("hidden");
    resultsSection?.classList.add("hidden");

    logoutBtn?.classList.add("hidden");
    entryViewBtn?.classList.add("hidden");
    resultsViewBtn?.classList.add("hidden");

    if (userLabel) userLabel.textContent = "Nicht angemeldet";
    if (password) password.value = "";
    setMsg(authMsg, "Abgemeldet.", true);

    // Storage cleanup
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(`${STORAGE_KEY}-code-verifier`);
    } catch (_) {}
    try {
      sessionStorage.clear();
    } catch (_) {}

    // best-effort sign out
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("signOut timeout")), 1500)),
      ]);
    } catch (_) {}

    // final check
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch (_) {}
      }
    } catch (_) {}
  };

  // ---------- Save entry ----------
  const saveEntry = async () => {
    setMsg(saveMsg, "");

    const d = datum?.value;
    const team_id = teamSelect?.value;
    const player_id = playerSelect?.value;
    const trainingstyp_id = typSelect?.value;

    if (!d) return setMsg(saveMsg, "Datum wählen.", false);
    if (!team_id) return setMsg(saveMsg, "Team wählen.", false);
    if (!player_id) return setMsg(saveMsg, "Spieler wählen.", false);
    if (!trainingstyp_id) return setMsg(saveMsg, "Trainingstyp wählen.", false);

    if (!state.anwesenheit) {
      if (!grundSelect?.value) return setMsg(saveMsg, "Grund wählen.", false);
    }

    const f = flagSelect?.value || "none";
    if (f !== "none") {
      if (!katSelect?.value) return setMsg(saveMsg, "Kategorie wählen.", false);
      if (!sevSelect?.value) return setMsg(saveMsg, "Schweregrad wählen.", false);
      if (wordsCount(notiz?.value) > 10) return setMsg(saveMsg, "Notiz: max. 10 Wörter.", false);
    }

    if (wordsCount(readyGrund?.value) > 10) return setMsg(saveMsg, "Readiness-Grund: max. 10 Wörter.", false);

    const { data: sess } = await supabase.auth.getSession();
    const coach_id = sess.session?.user?.id;
    if (!coach_id) return setMsg(saveMsg, "Nicht angemeldet.", false);

    const payload = {
      trainingsdatum: d,
      team_id,
      player_id,
      coach_id,
      trainingstyp_id,
      anwesenheit: state.anwesenheit,
      abgemeldet: state.anwesenheit ? false : state.abgemeldet,
      grund_id: state.anwesenheit ? null : (grundSelect?.value || null),
      auffaelligkeit: f,
      kategorie_id: f === "none" ? null : (katSelect?.value || null),
      schweregrad: f === "none" ? null : Number(sevSelect?.value),
      notiz: f === "none" ? null : ((notiz?.value || "").trim() || null),
      readiness: readySelect?.value ? Number(readySelect.value) : null,
      readiness_grund: (readyGrund?.value || "").trim() || null,
    };

    const res = await supabase
      .from("training_entries")
      .upsert(payload, { onConflict: "team_id,trainingsdatum,player_id,trainingstyp_id" })
      .select("id")
      .single();

    if (res.error) return setMsg(saveMsg, res.error.message || "Speichern fehlgeschlagen.", false);

    setMsg(saveMsg, "Gespeichert.", true);

    // Optional: refresh results if currently visible
    if (resultsSection && !resultsSection.classList.contains("hidden")) {
      await loadResultsForSelection();
    }
  };

  const nextPlayer = () => {
    const idx = state.players.findIndex((p) => p.id === playerSelect?.value);
    if (idx === -1) {
      if (playerSelect) playerSelect.value = "";
      return;
    }
    const next = state.players[idx + 1];
    if (playerSelect) playerSelect.value = next ? next.id : "";
  };

  // ---------- Results logic ----------
  function toISODate(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function startDateMonthsBack(months) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() - Number(months));
    return d;
  }

  function pct(part, total) {
    if (!total) return "0%";
    return `${Math.round((part / total) * 100)}%`;
  }

  function drawLine(ctx, labels, seriesA, seriesB, titleA, titleB) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    ctx.clearRect(0, 0, w, h);

    const padL = 40, padR = 10, padT = 10, padB = 30;

    ctx.strokeStyle = "#444";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, h - padB);
    ctx.lineTo(w - padR, h - padB);
    ctx.stroke();

    const maxVal = Math.max(1, ...seriesA, ...seriesB);
    const n = labels.length || 1;

    function xy(i, val) {
      const x = padL + (i * (w - padL - padR)) / Math.max(1, n - 1);
      const y = (h - padB) - (val * (h - padT - padB)) / maxVal;
      return [x, y];
    }

    function plot(series, color) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      series.forEach((v, i) => {
        const [x, y] = xy(i, v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    plot(seriesA, "#2e7dff");
    plot(seriesB, "#ff3b3b");

    ctx.fillStyle = "#aaa";
    ctx.font = "12px system-ui";
    ctx.fillText(`${titleA} (blau)`, padL, h - 10);
    ctx.fillText(`${titleB} (rot)`, padL + 140, h - 10);
  }

  async function loadResultsForSelection() {
    setMsg(resultsSummary, "");
    if (reasonsList) reasonsList.textContent = "";

    const team_id = teamSelect?.value;
    const player_id = playerSelect?.value;
    const months = rangeSelect?.value || "6";

    if (!team_id) return setMsg(resultsSummary, "Bitte zuerst ein Team wählen (in „Eintragen“).", false);
    if (!player_id) return setMsg(resultsSummary, "Bitte zuerst einen Spieler wählen (in „Eintragen“).", false);

    const startISO = toISODate(startDateMonthsBack(months));

    const { data, error } = await supabase
      .from("training_entries")
      .select("trainingsdatum, anwesenheit, abgemeldet, auffaelligkeit, grund_id")
      .eq("team_id", team_id)
      .eq("player_id", player_id)
      .gte("trainingsdatum", startISO)
      .order("trainingsdatum", { ascending: true });

    if (error) return setMsg(resultsSummary, `Ergebnisse laden fehlgeschlagen: ${error.message}`, false);

    const rows = data || [];
    const total = rows.length;

    const present = rows.filter((r) => r.anwesenheit === true).length;
    const absent = rows.filter((r) => r.anwesenheit === false).length;
    const excused = rows.filter((r) => r.anwesenheit === false && r.abgemeldet === true).length;
    const unexcused = rows.filter((r) => r.anwesenheit === false && r.abgemeldet === false).length;

    const pos = rows.filter((r) => r.auffaelligkeit === "positive").length;
    const neg = rows.filter((r) => r.auffaelligkeit === "negative").length;

    const reasonCounts = {};
    rows.forEach((r) => {
      if (r.anwesenheit === false && r.grund_id) {
        reasonCounts[r.grund_id] = (reasonCounts[r.grund_id] || 0) + 1;
      }
    });

    const reasonIds = Object.keys(reasonCounts);
    let reasonMap = {};
    if (reasonIds.length) {
      const rr = await supabase.from("config_gruende").select("id,wert").in("id", reasonIds);
      if (!rr.error) (rr.data || []).forEach((x) => (reasonMap[x.id] = x.wert));
    }

    // day series
    const dayMap = {};
    rows.forEach((r) => {
      const d = r.trainingsdatum;
      if (!dayMap[d]) dayMap[d] = { present: 0, absent: 0, pos: 0, neg: 0 };
      if (r.anwesenheit) dayMap[d].present += 1;
      else dayMap[d].absent += 1;
      if (r.auffaelligkeit === "positive") dayMap[d].pos += 1;
      if (r.auffaelligkeit === "negative") dayMap[d].neg += 1;
    });

    const labels = Object.keys(dayMap).sort();
    const sPresent = labels.map((d) => dayMap[d].present);
    const sAbsent = labels.map((d) => dayMap[d].absent);
    const sPos = labels.map((d) => dayMap[d].pos);
    const sNeg = labels.map((d) => dayMap[d].neg);

    const lines = [
      `Zeitraum: letzte ${months} Monat(e)`,
      `Einträge gesamt: ${total}`,
      `Anwesenheit: ${present} (${pct(present, total)})`,
      `Fehlend: ${absent} (${pct(absent, total)})`,
      `— abgemeldet: ${excused} (${pct(excused, total)})`,
      `— unentschuldigt: ${unexcused} (${pct(unexcused, total)})`,
      `Positiv: ${pos} (${pct(pos, total)})`,
      `Negativ: ${neg} (${pct(neg, total)})`,
    ];
    setMsg(resultsSummary, lines.join(" · "), true);

    if (!reasonIds.length) {
      if (reasonsList) reasonsList.textContent = "Keine Gründe im Zeitraum erfasst.";
    } else {
      const out = reasonIds
        .map((id) => ({ id, name: reasonMap[id] || id, n: reasonCounts[id] }))
        .sort((a, b) => b.n - a.n)
        .map((x) => `${x.name}: ${x.n}`)
        .join(" · ");
      if (reasonsList) reasonsList.textContent = out;
    }

    if (chartAttendance) drawLine(chartAttendance.getContext("2d"), labels, sPresent, sAbsent, "Anwesend", "Fehlend");
    if (chartFlags) drawLine(chartFlags.getContext("2d"), labels, sPos, sNeg, "Positiv", "Negativ");
  }

  // ---------- Event bindings ----------
  if (teamSelect) {
    teamSelect.addEventListener("change", async () => {
      // Clear player selection immediately
      if (playerSelect) playerSelect.value = "";
      await loadPlayersForTeam(teamSelect.value);
      // If results view open, refresh
      if (resultsSection && !resultsSection.classList.contains("hidden")) {
        await loadResultsForSelection();
      }
    });
  }

  if (flagSelect) flagSelect.addEventListener("change", updateFlagUI);

  if (attJa) attJa.addEventListener("click", () => { state.anwesenheit = true; updateAttendanceUI(); });
  if (attNein) attNein.addEventListener("click", () => { state.anwesenheit = false; updateAttendanceUI(); });

  if (excJa) attJa && excJa.addEventListener("click", () => { state.abgemeldet = true; updateExcusedUI(); });
  if (excNein) excNein.addEventListener("click", () => { state.abgemeldet = false; updateExcusedUI(); });

  if (loginBtn) loginBtn.addEventListener("click", login);
  if (logoutBtn) logoutBtn.addEventListener("click", logout);
  if (signupBtn) signupBtn.addEventListener("click", signup);

  if (saveBtn) saveBtn.addEventListener("click", saveEntry);
  if (nextBtn) nextBtn.addEventListener("click", nextPlayer);

  if (pwToggle && password) {
    pwToggle.addEventListener("click", () => {
      const isPw = password.type === "password";
      password.type = isPw ? "text" : "password";
      pwToggle.textContent = isPw ? "🙈" : "👁";
    });
  }

  if (entryViewBtn) entryViewBtn.addEventListener("click", showEntryView);
  if (resultsViewBtn) resultsViewBtn.addEventListener("click", showResultsView);
  if (rangeSelect) rangeSelect.addEventListener("change", loadResultsForSelection);

  if (playerSelect) {
    playerSelect.addEventListener("change", async () => {
      if (resultsSection && !resultsSection.classList.contains("hidden")) {
        await loadResultsForSelection();
      }
    });
  }

  // ---------- Init ----------
  updateAttendanceUI();
  updateFlagUI();

  supabase.auth.onAuthStateChange(() => setSessionUI());
  setSessionUI();
})();
