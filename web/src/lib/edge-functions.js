export function getEdgeFunctionToken(session, anonKey) {
  return session?.access_token || anonKey;
}

export function buildEdgeFunctionHeaders(token, anonKey) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    apikey: anonKey,
  };
}

export function getEdgeFunctionErrorMessage(fnName, status, text) {
  let message = `Edge Function ${fnName}: HTTP ${status}`;

  try {
    const parsed = JSON.parse(text);
    message = parsed.error?.message || parsed.msg || parsed.message || message;
  } catch {
    if (text) message += ` — ${text.slice(0, 200)}`;
  }

  return message;
}

export function buildAiRequestPayload({ systemPrompt, userMessage, maxTokens, model, userId, thinking }) {
  return {
    model,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    max_tokens: maxTokens,
    user_id: userId,
    // DeepSeek v4 uvažovací režim. Posíláme jen když je zadán (zpětně kompatibilní payload).
    ...(thinking ? { thinking } : {}),
  };
}
