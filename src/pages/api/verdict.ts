import type { APIRoute } from "astro";
import { judgeClaim } from "../../lib/verdict.ts";

export const POST: APIRoute = async ({ request }) => {
  let claim = "";
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json()) as { claim?: string };
    claim = body.claim ?? "";
  } else {
    const form = await request.formData();
    claim = String(form.get("claim") ?? "");
  }

  try {
    const result = await judgeClaim(claim);
    return new Response(JSON.stringify(result), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "The claim could not be judged.";
    const status = message.includes("TYPESAFE_API_KEY") || message.includes("Write a claim") ? 400 : 502;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
};
