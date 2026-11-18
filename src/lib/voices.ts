export const AGENT_VOICES = [
  { id: "alloy", label: "Alloy", hint: "Neutral, balanced" },
  { id: "echo", label: "Echo", hint: "Warm male" },
  { id: "fable", label: "Fable", hint: "Expressive British" },
  { id: "onyx", label: "Onyx", hint: "Deep male" },
  { id: "nova", label: "Nova", hint: "Friendly female" },
  { id: "shimmer", label: "Shimmer", hint: "Soft female" },
] as const;

export type AgentVoiceId = (typeof AGENT_VOICES)[number]["id"];

export function isAgentVoice(value: string): value is AgentVoiceId {
  return AGENT_VOICES.some((v) => v.id === value);
}

export function resolveAgentVoice(value?: string | null): AgentVoiceId {
  return value && isAgentVoice(value) ? value : "alloy";
}
