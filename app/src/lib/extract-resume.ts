import Anthropic from "@anthropic-ai/sdk";

export interface ExtractedResume {
  summary: string;
  skills: string[];
  experience: { title: string; company: string; startDate: string; endDate: string; description: string }[];
  education: { degree: string; school: string; year: string }[];
}

const client = new Anthropic();

const PROMPT = `Extract structured resume data and return ONLY valid JSON with this exact shape — no markdown, no explanation, just JSON:
{
  "summary": "2-3 sentence professional bio written in third person that sells this candidate to a hiring client",
  "skills": ["skill1", "skill2"],
  "experience": [{"title": "Job Title", "company": "Exact Employer Name", "startDate": "YYYY-MM", "endDate": "YYYY-MM or present", "description": "Brief description"}],
  "education": [{"degree": "Degree Name", "school": "School Name", "year": "YYYY"}]
}

Rules:
- summary: write a compelling 2-3 sentence bio in third person that highlights their most impressive experience, key skills, and what makes them stand out. Use the candidate's first name if available. Make it sound like a recruiter proudly presenting them to a client.
- Copy employer/company names exactly as written — do not paraphrase or abbreviate
- Include ALL jobs listed, in reverse chronological order
- For dates: use YYYY-MM if month is available, YYYY if only year, "present" for current roles
- For skills: extract explicitly listed skills AND infer from job descriptions (technologies, tools, methodologies)
- If a field is unknown leave it as an empty string, never omit the key`;

const EMPTY: ExtractedResume = { summary: "", skills: [], experience: [], education: [] };

async function callClaude(content: Anthropic.MessageParam["content"]): Promise<ExtractedResume> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return EMPTY;

  const parsed = JSON.parse(jsonMatch[0]) as ExtractedResume;
  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    skills: Array.isArray(parsed.skills) ? parsed.skills : [],
    experience: Array.isArray(parsed.experience) ? parsed.experience : [],
    education: Array.isArray(parsed.education) ? parsed.education : [],
  };
}

export async function extractResume(
  resumeUrl: string | null,
  resumeSummary: string
): Promise<ExtractedResume> {
  // Try PDF first
  if (resumeUrl) {
    try {
      const res = await fetch(resumeUrl);
      if (res.ok) {
        const contentType = res.headers.get("content-type") ?? "";
        if (contentType.includes("pdf") || resumeUrl.toLowerCase().includes(".pdf")) {
          const buffer = await res.arrayBuffer();
          const base64 = Buffer.from(buffer).toString("base64");
          return await callClaude([
            { type: "text", text: PROMPT },
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: base64 },
            } as any,
          ]);
        }
      }
    } catch {
      // fall through to summary
    }
  }

  // Fall back to resume-summary HTML
  if (!resumeSummary || resumeSummary.trim().length < 10) return EMPTY;
  try {
    return await callClaude([{ type: "text", text: `${PROMPT}\n\nResume summary:\n${resumeSummary}` }]);
  } catch {
    return EMPTY;
  }
}
