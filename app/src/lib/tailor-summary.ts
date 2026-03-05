import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function tailorSummary(
  candidateSummary: string,
  candidateName: string,
  roleTitle: string,
  roleDescription: string | null
): Promise<string> {
  if (!candidateSummary) return "";

  const safeName = candidateName.trim() || "this candidate";
  const roleContext = roleDescription
    ? `Role: ${roleTitle}\nRequirements/Description:\n${roleDescription}`
    : `Role: ${roleTitle}`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system:
        "You are an expert recruiter writing tailored candidate summaries for client presentations. Write in third person. Return ONLY the summary text, no labels or extra formatting.",
      messages: [
        {
          role: "user",
          content: `${roleContext}\n\nCandidate's general summary:\n${candidateSummary}\n\nRewrite this as a 2-3 sentence summary that specifically highlights how ${safeName}'s background and skills are a strong match for the ${roleTitle} role. Be concrete and persuasive.`,
        },
      ],
    });

    if (!message.content.length) return candidateSummary;
    const block = message.content[0];
    if (block.type !== "text") return candidateSummary;
    return block.text.trim();
  } catch (error) {
    console.error("tailorSummary: Anthropic API error", error);
    return candidateSummary;
  }
}
