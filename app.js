(() => {
  const APP_VERSION = "1";
  const STORAGE_KEY = `jsg_auth_${APP_VERSION}`;
  window.onerror = (msg, src, line, col) => {
    const t = document.getElementById("authMsg");
    if (t) t.textContent = `JS-Fehler: ${msg} (${line}:${col})`;
  };
  window.onunhandledrejection = (e) => {
    const t = document.getElementById("authMsg");
    const m = (e && e.reason && e.reason.message) ? e.reason.message : String(e.reason || e);
    if (t) t.textContent = `Promise-Fehler: ${m}`;
  };

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
    detectSessionInUrl: false
  }
});
try {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && k.startsWith("jsg_auth_") && k !== STORAGE_KEY) localStorage.removeItem(k);
  }
} catch (e) {}

  const el = (id) => document.getElementById(id);
  const setMsg = (target, text, ok = true) => {
    if (!target) return;
    target.textContent = text || "";
    target.style.color = ok ? "var(--muted)" : "var(--danger)";
  };

  const authSection = el("authSection");
  const appSection = el("appSection");
  const userLabel = el("userLabel");
  const logoutBtn = el("logoutBtn");

  const email = el("email");
  const password = el("password");
  const pwToggle = el("pwToggle");
  const loginBtn = el("loginBtn");
  const signupBtn = el("signupBtn");
  const authMsg = el("authMsg");
  const inviteCode = el("inviteCode");
  
const signup = async () => {
  setMsg(authMsg, "");

  const em = (email?.value || "").trim();
  const pw = password?.value || "";
  const code = (inviteCode?.value || "").trim();

  if (!em) return setMsg(authMsg, "E-Mail fehlt.", false);
  if (!pw) return setMsg(authMsg, "Passwort fehlt.", false);
  if (!code) return setMsg(authMsg, "Invite-Code fehlt.", false);

  try {
    if (signupBtn) { signupBtn.disabled = true; signupBtn.textContent = "Lädt…"; }
    setMsg(authMsg, "Registrierung läuft…", true);

    const res = await fetch("/signup", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: em, password: pw, inviteCode: code })
});

// robust: JSON oder Text
const raw = await res.text();
let data = {};
try { data = raw ? JSON.parse(raw) : {}; } catch (_) {}

if (!res.ok || !data.ok) {
  const code = (data && (data.error || data.message)) ? (data.error || data.message) : "";

  if (code === "INVITE_INVALID") {
    return setMsg(authMsg, "Invite-Code ist falsch.", false);
  }
  if (code === "MISSING_FIELDS") {
    return setMsg(authMsg, "E-Mail/Passwort/Invite-Code fehlt.", false);
  }
  if (typeof code === "string" && code.toLowerCase().includes("already")) {
    return setMsg(authMsg, "E-Mail ist bereits registriert.", false);
  }
  if (typeof code === "string" && code.toLowerCase().includes("password")) {
    return setMsg(authMsg, "Passwort erfüllt die Anforderungen nicht.", false);
  }

  return setMsg(authMsg, "Registrieren fehlgeschlagen.", false);
}

    setMsg(authMsg, "Konto erstellt. Bitte anmelden. Freischaltung durch Admin nötig.", true);
    if (password) password.value = "";
  } finally {
    if (signupBtn) { signupBtn.disabled = false; signupBtn.textContent = "Registrieren"; }
  }
};
  
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

  let state = {
    anwesenheit: true,
    abgemeldet: false,
    config: { typen: [], gruende: [], kategorien: [] },
    teams: [],
    players: [],
  };

  const wordsCount = (s) => (!s ? 0 : s.trim().split(/\s+/).filter(Boolean).length);

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
      if (grundWrap) grundWrap.classList.add("hidden");
      if (grundSelect) grundSelect.value = "";
    } else {
      if (grundWrap) grundWrap.classList.remove("hidden");
    }
  };

  const updateExcusedUI = () => {
    setActive(excJa, excNein, state.abgemeldet, true);
  };

  const updateFlagUI = () => {
    const f = flagSelect?.value || "none";
    const show = f !== "none";
    if (katWrap) katWrap.classList.toggle("hidden", !show);
    if (sevWrap) sevWrap.classList.toggle("hidden", !show);
    if (notizWrap) notizWrap.classList.toggle("hidden", !show);
    if (!show) {
      if (katSelect) katSelect.value = "";
      if (sevSelect) sevSelect.value = "";
      if (notiz) notiz.value = "";
    }
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

    fillSelect(typSelect, state.config.typen);
    fillSelect(grundSelect, state.config.gruende, "Grund wählen…");
    fillSelect(katSelect, state.config.kategorien);
  };

  const loadTeams = async () => {
    const { data, error } = await supabase.from("teams").select("id,name").eq("aktiv", true).order("name");
    if (error) throw error;
    state.teams = (data || []).map(x => ({ id: x.id, label: x.name }));
    fillSelect(teamSelect, state.teams, "Team wählen…");
  };

  const loadPlayersForTeam = async (teamId) => {
    if (!teamId) {
      state.players = [];
      fillSelect(playerSelect, [], "Spieler wählen…");
      return;
    }

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

    state.players = list;
    fillSelect(playerSelect, list, "Spieler wählen…");
  };

  const refreshAppData = async () => {
    await loadConfig();
    await loadTeams();
    await loadPlayersForTeam(teamSelect?.value);
  };

  const setSessionUI = async () => {
    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (!session) {
      authSection?.classList.remove("hidden");
      appSection?.classList.add("hidden");
      logoutBtn?.classList.add("hidden");
      if (userLabel) userLabel.textContent = "Nicht angemeldet";
      return;
    }

    authSection?.classList.add("hidden");
    appSection?.classList.remove("hidden");
    logoutBtn?.classList.remove("hidden");
    if (userLabel) userLabel.textContent = session.user.email || "Angemeldet";

    try {
      await refreshAppData();
    } catch (e) {
      setMsg(saveMsg, `Laden fehlgeschlagen: ${e.message}`, false);
    }
  };

  const login = async () => {
    try {
      setMsg(authMsg, "Anmeldung läuft…", true);
      loginBtn.disabled = true;
      loginBtn.textContent = "Lädt…";

      const em = email.value.trim();
      const pw = password.value;

      if (!em) { setMsg(authMsg, "E-Mail fehlt.", false); return; }
      if (!pw) { setMsg(authMsg, "Passwort fehlt.", false); return; }

      const { error } = await supabase.auth.signInWithPassword({ email: em, password: pw });
      if (error) { setMsg(authMsg, error.message || "Anmeldung fehlgeschlagen.", false); return; }

      setMsg(authMsg, "Angemeldet.", true);
      await setSessionUI();
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = "Anmelden";
    }
  };

  const logout = async () => {
  // UI sofort zurücksetzen (darf nie hängen)
  authSection?.classList.remove("hidden");
  appSection?.classList.add("hidden");
  logoutBtn?.classList.add("hidden");
  if (userLabel) userLabel.textContent = "Nicht angemeldet";
  if (password) password.value = "";
  setMsg(authMsg, "Abgemeldet.", true);

  // Storage hart löschen (Brave/localhost)
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(`${STORAGE_KEY}-code-verifier`);
  } catch (e) {}
  try { sessionStorage.clear(); } catch (e) {}

  // SignOut: best effort mit Timeout, darf UI nicht blockieren
  try {
    await Promise.race([
      supabase.auth.signOut(),               // ohne scope, am kompatibelsten
      new Promise((_, rej) => setTimeout(() => rej(new Error("signOut timeout")), 1500))
    ]);
  } catch (e) {
  // ignored
}

  // finale Absicherung: Session nochmal ziehen und ggf. nochmals Storage killen
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session) {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    }
  } catch (e) {}
};
  

  const saveEntry = async () => {
  setMsg(saveMsg, "");

  const d = datum.value;
  const team_id = teamSelect.value;
  const player_id = playerSelect.value;
  const trainingstyp_id = typSelect.value;

  if (!d) return setMsg(saveMsg, "Datum wählen.", false);
  if (!team_id) return setMsg(saveMsg, "Team wählen.", false);
  if (!player_id) return setMsg(saveMsg, "Spieler wählen.", false);
  if (!trainingstyp_id) return setMsg(saveMsg, "Trainingstyp wählen.", false);

  if (!state.anwesenheit) {
    if (!grundSelect.value) return setMsg(saveMsg, "Grund wählen.", false);
  }

  const f = flagSelect.value;
  if (f !== "none") {
    if (!katSelect.value) return setMsg(saveMsg, "Kategorie wählen.", false);
    if (!sevSelect.value) return setMsg(saveMsg, "Schweregrad wählen.", false);
    if (wordsCount(notiz.value) > 10) return setMsg(saveMsg, "Notiz: max. 10 Wörter.", false);
  }

  if (wordsCount(readyGrund.value) > 10) return setMsg(saveMsg, "Readiness-Grund: max. 10 Wörter.", false);

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
    grund_id: state.anwesenheit ? null : (grundSelect.value || null),
    auffaelligkeit: f,
    kategorie_id: f === "none" ? null : (katSelect.value || null),
    schweregrad: f === "none" ? null : Number(sevSelect.value),
    notiz: f === "none" ? null : (notiz.value.trim() || null),
    readiness: readySelect.value ? Number(readySelect.value) : null,
    readiness_grund: readyGrund.value.trim() || null,
  };

  const res = await supabase
    .from("training_entries")
    .upsert(payload, { onConflict: "team_id,trainingsdatum,player_id,trainingstyp_id" })
    .select("id")
    .single();

  if (res.error) {
    setMsg(saveMsg, res.error.message || "Speichern fehlgeschlagen.", false);
    return;
  }

  setMsg(saveMsg, "Gespeichert.", true);
};

  const nextPlayer = () => {
    const idx = state.players.findIndex(p => p.id === playerSelect.value);
    if (idx === -1) { playerSelect.value = ""; return; }
    const next = state.players[idx + 1];
    playerSelect.value = next ? next.id : "";
  };

    // --- EVENT BINDINGS (single source of truth) ---
  if (teamSelect) teamSelect.addEventListener("change", () => loadPlayersForTeam(teamSelect.value));
  if (flagSelect) flagSelect.addEventListener("change", updateFlagUI);

  if (attJa) attJa.addEventListener("click", () => { state.anwesenheit = true; updateAttendanceUI(); });
  if (attNein) attNein.addEventListener("click", () => { state.anwesenheit = false; updateAttendanceUI(); });

  if (excJa) excJa.addEventListener("click", () => { state.abgemeldet = true; updateExcusedUI(); });
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

  // --- INIT (after bindings) ---
  updateAttendanceUI();
  updateFlagUI();

  supabase.auth.onAuthStateChange(() => setSessionUI());
  setSessionUI();
})();
