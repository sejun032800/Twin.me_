// ─── delete-account — 계정 삭제(§8 설정 탭) ───────────────────────────────────
// 호출자의 Authorization 헤더(JWT)로 신원을 확인한 뒤, service role 클라이언트로만
// couples 관련 행 삭제 + auth.admin.deleteUser를 수행한다. SUPABASE_URL/ANON_KEY/
// SERVICE_ROLE_KEY는 Supabase Edge Functions가 모든 함수에 자동 주입하는 예약 env var라
// 별도 secret 설정 없이 바로 쓸 수 있다.

import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Authorization header missing" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 호출자 신원 확인 — anon key + 호출자의 JWT로 조회 (service role 키로는 아무 유저나
    // 넘길 수 있으므로, 반드시 이 클라이언트로 "본인" 여부를 먼저 검증한다)
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await callerClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "인증되지 않은 요청입니다" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 실제 삭제는 service role 클라이언트로만 수행
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { error: coupleError } = await adminClient
      .from("couples")
      .delete()
      .or(`creator_id.eq.${user.id},partner_id.eq.${user.id}`);

    if (coupleError) {
      throw new Error(`couples 삭제 실패: ${coupleError.message}`);
    }

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteUserError) {
      throw new Error(`계정 삭제 실패: ${deleteUserError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
