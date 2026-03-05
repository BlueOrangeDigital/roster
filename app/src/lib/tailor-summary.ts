import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function tailorSummary(
  candidateSummary: string,
  candidateName: string,
  roleTitle: string,
  roleDescription: string | null
): Promise<string> {
  if (!candidateSummary) return "";

  const roleContext = roleDescription
    ? `Role: ${roleTitle}\nRequirements/Description:\n${roleDescription}`
    : `Role: ${roleTitle}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `You are writing a tailored candidate summary for a client presentation.

${roleContext}

Candidate's general summary:
${candidateSummary}

Rewrite this as a 2-3 sentence summary that specifically highlights how ${candidateName}'s background and skills are a strong match for the ${roleTitle} role. Be concrete and persuasive. Write in third person. Return ONLY the summary text, no labels or extra formatting.`,
      },
    ],
  });

  const block = message.content[0];
  if (block.type !== "text") return candidateSummary;
  return block.text.trim();
}
