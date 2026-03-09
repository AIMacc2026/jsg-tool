export async function onRequestPost(ctx) {
  const { request, env } = ctx;

  // ENV required:
  // SUPABASE_URL
  // SUPABASE_SERVICE_ROLE_KEY
  // INVITE_CODE

  const body = await request.json().catch(() => null);
  if (!body) return new Response("Bad JSON", { status: 400 });

  const { email, password, inviteCode } = body;

  if (!email || !password) {
    return new Response(JSON.stringify({ ok: false, error: "MISSING_FIELDS" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (!inviteCode || inviteCode !== env.INVITE_CODE) {
    return new Response(JSON.stringify({ ok: false, error: "INVITE_INVALID" }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Create user via Supabase Admin API (service role)
  const adminUrl = `${env.SUPABASE_URL}/auth/v1/admin/users`;
  const createResp = await fetch(adminUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { name_anzeige: email.split("@")[0] }
    })
  });

  const created = await createResp.json().catch(() => ({}));
  if (!createResp.ok) {
    return new Response(JSON.stringify({ ok: false, error: created?.msg || created?.message || "CREATE_FAILED" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Ensure profiles row exists (coach + not freigeschaltet)
  const userId = created?.id;
  if (userId) {
    await fetch(`${env.SUPABASE_URL}/rest/v1/profiles`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
      },
      body: JSON.stringify({
        user_id: userId,
        rolle: "coach",
        name_anzeige: email.split("@")[0],
        freigeschaltet: false
      })
    }).catch(() => {});
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" }
  });
}
