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
    const { systemPrompt, userMessage, maxTokens = 1000, stream = false } = await req.json();

    if (!userMessage) {
      return new Response(
        JSON.stringify({ error: "userMessage is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    const endpoint = stream ? "streamGenerateContent" : "generateContent";
    const url = stream
      ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:${endpoint}?key=${apiKey}&alt=sse`
      : `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:${endpoint}?key=${apiKey}`;

    const body = {
      system_instruction: {
        parts: [{ text: systemPrompt ?? "You are a helpful assistant." }]
      },
      contents: [
        { role: "user", parts: [{ text: userMessage }] }
      ],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.9,
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API 오류: ${err}`);
    }

    if (stream) {
      return new Response(response.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    return new Response(
      JSON.stringify({ content: text }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
