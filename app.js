(() => {
  // Guard gegen doppelte Initialisierung
  if (window.__JSG_APP_INIT__) return;
  window.__JSG_APP_INIT__ = true;

  const SUPABASE_URL = "https://ccyhlcwgphvyyazpmcnq.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_l3XkI9FMLP25WRwbqJaiPA_542-9zGS";

  // Auto-Logout nach 5 Minuten Inaktivität
  const IDLE_MS = 5 * 60 * 1000;
  let idleTimer = null;

  const el = (id) => document.getElementById(id);
  const setMsg = (target, text, ok = true) => {
    if (!target) return;
    target.textContent = text || "";
    target.style.color = ok ? "var(--muted)" : "var(--danger)";
  };

  // Supabase UMD
  const SB = window.Supabase || window.supabase || window.supabaseJs;
  if (!SB || typeof SB.createClient !== "function") {
    const t = el("authMsg");
    if (t) t.textContent = "Supabase-Library nicht geladen.";
    return;
  }

  // WICHTIG: Keine custom storageKeys, kein Cleanup beim Start.
  // Supabase default Session-Handling ist genau für Login/Logout/Refresh gemacht.
  const supabase = SB.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // DOM
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
  const inviteCode = el("inviteCode");
  const loginBtn = el("loginBtn");
  const signupBtn = el("signupBtn");
  const authMsg = el("authMsg");

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

  // Results
  const resTeamSelect = el("resTeamSelect");
  const resPlayerSelect = el("resPlayerSelect");
  const rangeSelect = el("rangeSelect");
  const resLoadBtn = el("resLoadBtn");
  const resultsSummary = el("resultsSummary");
  const reasonsList = el("reasonsList");
  const chartAttendance = el("chartAttendance");
  const chartFlags = el("chartFlags");

  const state = {
    anwesenheit: true,
    abgemeldet: false,
    teams: [],
    config: { typen: [], gruende: [], kategorien: [] },
  };

  const resetIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => logout(true), IDLE_MS);
  };

  const bindActivity = () => {
    ["click", "keydown", "touchstart", "pointerdown", "scroll"].forEach(evt => {
      document.addEventListener(evt, () => {
        // nur wenn eingeloggt:
        resetIdle();
      }, { passive: true });
    });
  };

  const wordsCount = (s) => (!s ? 0 : s.trim().split(/\s+/).filter(Boolean).length);

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

  const updateExcusedUI = () => setActive(excJa, excNein, state.abgemeldet, true);

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

  const showResultsView = () => {
    appSection?.classList.add("hidden");
    resultsSection?.classList.remove("hidden");
  };

  // ---------- Data ----------
  const loadConfig = async () => {
    const [typen, gruende, kategorien] = await Promise.all([
      supabase.from("config_trainingstypen").select("id,wert,sortierung").eq("aktiv", true).order("sortierung"),
      supabase.from("config_gruende").select("id,wert,sortierung").eq("aktiv", true).order("sortierung"),
      supabase.from("config_kategorien").select("id,wert,sortierung").eq("aktiv", true).order("sortierung"),
    ]);
    if (typen.error) throw typen.error;
    if (gruende.error) throw gruende.error;
    if (kategorien.error) throw kategorien.error;

    state.config.typen = (typen.data || []).map(x => ({ id: x.id, label: x.wert }));
    state.config.gruende = (gruende.data || []).map(x => ({ id: x.id, label: x.wert }));
    state.config.kategorien = (kategorien.data || []).map(x => ({ id: x.id, label: x.wert }));

    fillSelect(typSelect, state.config.typen, "Trainingstyp wählen…");
    fillSelect(grundSelect, state.config.gruende, "Grund wählen…");
    fillSelect(katSelect, state.config.kategorien, "Kategorie wählen…");
  };

  const loadTeams = async () => {
    const { data, error } = await supabase.from("teams").select("id,name").eq("aktiv", true).order("name");
    if (error) throw error;
    state.teams = (data || []).map(x => ({ id: x.id, label: x.name }));
    fillSelect(teamSelect, state.teams, "Team wählen…");
    fillSelect(resTeamSelect, state.teams, "Team wählen…");
  };

  const loadPlayersForTeam = async (teamId, selectEl) => {
    fillSelect(selectEl, [], "Spieler wählen…");
    if (!teamId) return;

    const { data, error } = await supabase
      .from("team_memberships")
      .select("player_id, players:players(id,vorname,nachname,jahrgang,status)")
      .eq("team_id", teamId)
      .is("bis_datum", null);

    if (error) throw error;

    const list = (data || [])
      .map(r => r.players)
      .filter(p => p && p.status === "aktiv")
      .map(p => ({ id: p.id, label: `${p.vorname} ${p.nachname} ${p.jahrgang}` }))
      .sort((a,b) => a.label.localeCompare(b.label, "de"));

    fillSelect(selectEl, list, list.length ? "Spieler wählen…" : "Keine Spieler im Team");
  };

  const refreshAppData = async () => {
    await loadConfig();
    await loadTeams();
    await loadPlayersForTeam(teamSelect?.value || "", playerSelect);
    await loadPlayersForTeam(resTeamSelect?.value || "", resPlayerSelect);
  };

  // ---------- Session UI ----------
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

    await refreshAppData();
    resetIdle();
  };

  // ---------- Auth ----------
  const signup = async () => {
    setMsg(authMsg, "");
    const em = (email?.value || "").trim();
    const pw = password?.value || "";
    const code = (inviteCode?.value || "").trim();

    if (!em) return setMsg(authMsg, "E-Mail fehlt.", false);
    if (!pw) return setMsg(authMsg, "Passwort fehlt.", false);
    if (!code) return setMsg(authMsg, "Invite-Code fehlt.", false);

    try {
      signupBtn.disabled = true;
      signupBtn.textContent = "Lädt…";
      setMsg(authMsg, "Registrierung läuft…", true);

      const res = await fetch("/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em, password: pw, inviteCode: code }),
      });

      const raw = await res.text();
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch (_) {}

      if (!res.ok || !data.ok) {
        const c = (data && (data.error || data.message)) ? (data.error || data.message) : "";
        if (c === "INVITE_INVALID") return setMsg(authMsg, "Invite-Code ist falsch.", false);
        if (c === "MISSING_FIELDS") return setMsg(authMsg, "E-Mail/Passwort/Invite-Code fehlt.", false);
        if (typeof c === "string" && c.toLowerCase().includes("already")) return setMsg(authMsg, "E-Mail ist bereits registriert.", false);
        if (typeof c === "string" && c.toLowerCase().includes("password")) return setMsg(authMsg, "Passwort erfüllt die Anforderungen nicht.", false);
        return setMsg(authMsg, "Registrieren fehlgeschlagen.", false);
      }

      setMsg(authMsg, "Konto erstellt. Bitte anmelden. Freischaltung durch Admin nötig.", true);
      if (password) password.value = "";
    } finally {
      signupBtn.disabled = false;
      signupBtn.textContent = "Registrieren";
    }
  };

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

  const logout = async (auto = false) => {
    try {
      await supabase.auth.signOut();
    } catch (_) {}

    // UI sauber zurück
    authSection?.classList.remove("hidden");
    appSection?.classList.add("hidden");
    resultsSection?.classList.add("hidden");

    logoutBtn?.classList.add("hidden");
    entryViewBtn?.classList.add("hidden");
    resultsViewBtn?.classList.add("hidden");

    if (userLabel) userLabel.textContent = "Nicht angemeldet";
    if (password) password.value = "";
    setMsg(authMsg, auto ? "Automatisch abgemeldet (Inaktivität)." : "Abgemeldet.", true);
  };

  // ---------- Save ----------
  const saveEntry = async () => {
    resetIdle();
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

    if (res.error) return setMsg(saveMsg, `Speichern fehlgeschlagen: ${res.error.message}`, false);
    setMsg(saveMsg, "Gespeichert.", true);
  };

  const nextPlayer = () => {
    resetIdle();
    const opts = [...(playerSelect?.options || [])].filter(o => o.value);
    const idx = opts.findIndex(o => o.value === playerSelect.value);
    const next = opts[idx + 1];
    if (playerSelect) playerSelect.value = next ? next.value : "";
  };

  // ---------- Results ----------
  const toISO = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };
  const startDateMonthsBack = (months) => {
    const d = new Date();
    d.setHours(0,0,0,0);
    d.setMonth(d.getMonth() - Number(months));
    return d;
  };
  const pct = (part, total) => total ? `${Math.round((part/total)*100)}%` : "0%";

  const drawLine = (ctx, labels, seriesA, seriesB, titleA, titleB) => {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    ctx.clearRect(0,0,w,h);
    const padL=40,padR=10,padT=10,padB=30;

    ctx.strokeStyle="#444"; ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(padL,padT);
    ctx.lineTo(padL,h-padB);
    ctx.lineTo(w-padR,h-padB);
    ctx.stroke();

    const maxVal = Math.max(1, ...seriesA, ...seriesB);
    const n = labels.length || 1;
    const xy = (i,val)=>[
      padL + (i*(w-padL-padR))/Math.max(1,n-1),
      (h-padB) - (val*(h-padT-padB))/maxVal
    ];
    const plot=(s,c)=>{
      ctx.strokeStyle=c; ctx.lineWidth=2; ctx.beginPath();
      s.forEach((v,i)=>{ const [x,y]=xy(i,v); i?ctx.lineTo(x,y):ctx.moveTo(x,y); });
      ctx.stroke();
    };
    plot(seriesA,"#2e7dff");
    plot(seriesB,"#ff3b3b");

    ctx.fillStyle="#aaa"; ctx.font="12px system-ui";
    ctx.fillText(`${titleA} (blau)`, padL, h-10);
    ctx.fillText(`${titleB} (rot)`, padL+140, h-10);
  };

  const loadResults = async () => {
    resetIdle();
    setMsg(resultsSummary, "");
    if (reasonsList) reasonsList.textContent = "";

    const team_id = resTeamSelect?.value;
    const player_id = resPlayerSelect?.value || "";
    const months = rangeSelect?.value || "6";
    if (!team_id) return setMsg(resultsSummary, "Team wählen.", false);

    const startISO = toISO(startDateMonthsBack(months));

    let q = supabase
      .from("training_entries")
      .select("trainingsdatum, player_id, anwesenheit, abgemeldet, auffaelligkeit, grund_id")
      .eq("team_id", team_id)
      .gte("trainingsdatum", startISO)
      .order("trainingsdatum", { ascending: true });

    if (player_id) q = q.eq("player_id", player_id);

    const { data, error } = await q;
    if (error) return setMsg(resultsSummary, `Laden fehlgeschlagen: ${error.message}`, false);

    const rows = data || [];
    if (!rows.length) return setMsg(resultsSummary, "Keine Daten im Zeitraum.", true);

    const dayPerPlayer = {};
    const reasonCounts = {};

    rows.forEach(r => {
      const d = r.trainingsdatum;
      const pid = r.player_id;
      if (!dayPerPlayer[d]) dayPerPlayer[d] = {};
      if (!dayPerPlayer[d][pid]) dayPerPlayer[d][pid] = { presentAny:false, posAny:false, negAny:false };

      const cell = dayPerPlayer[d][pid];

      if (r.anwesenheit === true) cell.presentAny = true;
      if (r.anwesenheit === false && r.grund_id) {
        reasonCounts[r.grund_id] = (reasonCounts[r.grund_id]||0) + 1;
      }
      if (r.auffaelligkeit === "positive") cell.posAny = true;
      if (r.auffaelligkeit === "negative") cell.negAny = true;
    });

    const dayMap = {};
    Object.keys(dayPerPlayer).sort().forEach(date => {
      const players = Object.values(dayPerPlayer[date]);
      dayMap[date] = {
        present: players.filter(p => p.presentAny).length,
        absent:  players.filter(p => !p.presentAny).length,
        pos:     players.filter(p => p.posAny).length,
        neg:     players.filter(p => p.negAny).length,
      };
    });

    const labels = Object.keys(dayMap).sort();
    const sPresent = labels.map(d => dayMap[d].present);
    const sAbsent  = labels.map(d => dayMap[d].absent);
    const sPos     = labels.map(d => dayMap[d].pos);
    const sNeg     = labels.map(d => dayMap[d].neg);

    const sumPresent = sPresent.reduce((a,b)=>a+b,0);
    const sumAbsent  = sAbsent.reduce((a,b)=>a+b,0);
    const sumPos     = sPos.reduce((a,b)=>a+b,0);
    const sumNeg     = sNeg.reduce((a,b)=>a+b,0);
    const denom = sumPresent + sumAbsent;

    setMsg(resultsSummary, [
      `Zeitraum: letzte ${months} Monat(e)`,
      player_id ? `Spieler-Ansicht (pro Tag)` : `Team-Ansicht (pro Tag, Summe Spieler)`,
      `Anwesend: ${sumPresent} (${pct(sumPresent, denom)})`,
      `Fehlend: ${sumAbsent} (${pct(sumAbsent, denom)})`,
      `Positiv: ${sumPos} (${pct(sumPos, denom)})`,
      `Negativ: ${sumNeg} (${pct(sumNeg, denom)})`,
    ].join(" · "), true);

    const reasonIds = Object.keys(reasonCounts);
    if (!reasonIds.length) {
      if (reasonsList) reasonsList.textContent = "Keine Gründe im Zeitraum erfasst.";
    } else {
      const rr = await supabase.from("config_gruende").select("id,wert").in("id", reasonIds);
      const nameMap = {};
      if (!rr.error) (rr.data||[]).forEach(x => nameMap[x.id] = x.wert);

      if (reasonsList) reasonsList.textContent = reasonIds
        .map(id => ({ name: nameMap[id] || id, n: reasonCounts[id] }))
        .sort((a,b)=>b.n-a.n)
        .map(x => `${x.name}: ${x.n}`)
        .join(" · ");
    }

    if (chartAttendance) drawLine(chartAttendance.getContext("2d"), labels, sPresent, sAbsent, "Anwesend", "Fehlend");
    if (chartFlags) drawLine(chartFlags.getContext("2d"), labels, sPos, sNeg, "Positiv", "Negativ");
  };

  // ---------- Events ----------
  if (pwToggle && password) {
    pwToggle.addEventListener("click", () => {
      const isPw = password.type === "password";
      password.type = isPw ? "text" : "password";
      pwToggle.textContent = isPw ? "🙈" : "👁";
    });
  }

  if (teamSelect) teamSelect.addEventListener("change", () => loadPlayersForTeam(teamSelect.value, playerSelect));
  if (resTeamSelect) resTeamSelect.addEventListener("change", () => loadPlayersForTeam(resTeamSelect.value, resPlayerSelect));

  if (attJa) attJa.addEventListener("click", () => { state.anwesenheit = true; updateAttendanceUI(); resetIdle(); });
  if (attNein) attNein.addEventListener("click", () => { state.anwesenheit = false; updateAttendanceUI(); resetIdle(); });
  if (excJa) excJa.addEventListener("click", () => { state.abgemeldet = true; updateExcusedUI(); resetIdle(); });
  if (excNein) excNein.addEventListener("click", () => { state.abgemeldet = false; updateExcusedUI(); resetIdle(); });

  if (flagSelect) flagSelect.addEventListener("change", () => { updateFlagUI(); resetIdle(); });

  if (loginBtn) loginBtn.addEventListener("click", () => { resetIdle(); login(); });
  if (signupBtn) signupBtn.addEventListener("click", () => { resetIdle(); signup(); });
  if (logoutBtn) logoutBtn.addEventListener("click", () => logout(false));

  if (saveBtn) saveBtn.addEventListener("click", saveEntry);
  if (nextBtn) nextBtn.addEventListener("click", nextPlayer);

  if (entryViewBtn) entryViewBtn.addEventListener("click", () => { showEntryView(); resetIdle(); });
  if (resultsViewBtn) resultsViewBtn.addEventListener("click", () => { showResultsView(); resetIdle(); });

  if (resLoadBtn) resLoadBtn.addEventListener("click", loadResults);

  // ---------- Init ----------
  updateAttendanceUI();
  updateFlagUI();
  bindActivity();

  supabase.auth.onAuthStateChange(() => setSessionUI());
  setSessionUI();
})();
