/** Max cover letter length stored on JobApplication */
export const COVER_LETTER_MAX = 5000;

const FLAG_KEYS = ["experience", "locationComfort", "immediateJoin", "salaryComfort"];

const FLAG_LABELS = {
  experience: "experience requirement",
  locationComfort: "location",
  immediateJoin: "immediate availability",
  salaryComfort: "salary expectations",
};

/**
 * Validates applicant payload against job.screening.
 * @returns {{ ok: true, normalized: { acknowledgments: object, customAnswers: array } } | { ok: false, message: string }}
 */
export function validateApplicationScreening(jobScreening, body) {
  const js = jobScreening && typeof jobScreening === "object" ? jobScreening : {};
  const screeningIn = body?.screening && typeof body.screening === "object" ? body.screening : {};
  const ackIn = screeningIn.acknowledgments && typeof screeningIn.acknowledgments === "object" ? screeningIn.acknowledgments : {};

  const acknowledgments = {};
  for (const key of FLAG_KEYS) {
    if (js[key] === true) {
      if (ackIn[key] !== true) {
        return {
          ok: false,
          message: `Please confirm the screening item about ${FLAG_LABELS[key] || key}.`,
        };
      }
      acknowledgments[key] = true;
    }
  }

  const jobQuestions = Array.isArray(js.customQuestions)
    ? js.customQuestions.map((q) => String(q ?? "").trim()).filter(Boolean)
    : [];

  let customAnswers = [];
  const rawCustom = screeningIn.customAnswers;

  if (jobQuestions.length === 0) {
    customAnswers = [];
  } else if (Array.isArray(rawCustom)) {
    if (rawCustom.length !== jobQuestions.length) {
      return { ok: false, message: "Answer all employer screening questions." };
    }
    for (let i = 0; i < jobQuestions.length; i++) {
      const item = rawCustom[i];
      let answer = "";
      if (item && typeof item === "object" && item.answer !== undefined) {
        answer = String(item.answer ?? "").trim();
      } else if (typeof item === "string") {
        answer = item.trim();
      }
      if (!answer) {
        return {
          ok: false,
          message: `Please provide an answer for: "${jobQuestions[i].slice(0, 120)}${jobQuestions[i].length > 120 ? "…" : ""}"`,
        };
      }
      customAnswers.push({ question: jobQuestions[i], answer });
    }
  } else {
    return { ok: false, message: "Answer all employer screening questions." };
  }

  return {
    ok: true,
    normalized: {
      acknowledgments,
      customAnswers,
    },
  };
}

export function normalizeCoverLetter(raw) {
  if (raw === undefined || raw === null) return { value: "" };
  const s = String(raw).trim();
  if (s.length > COVER_LETTER_MAX) {
    return { error: `Cover letter must be at most ${COVER_LETTER_MAX} characters.` };
  }
  return { value: s };
}

/** Shape stored on JobApplication.screening for API JSON */
export function formatScreeningForClient(screening) {
  if (!screening || typeof screening !== "object") {
    return { acknowledgments: {}, customAnswers: [] };
  }
  const ack = screening.acknowledgments && typeof screening.acknowledgments === "object" ? screening.acknowledgments : {};
  const outAck = {};
  for (const k of ["experience", "locationComfort", "immediateJoin", "salaryComfort"]) {
    if (ack[k] === true) outAck[k] = true;
  }
  const customAnswers = Array.isArray(screening.customAnswers)
    ? screening.customAnswers.map((c) => ({
        question: String(c?.question ?? "").trim(),
        answer: String(c?.answer ?? "").trim(),
      }))
    : [];
  return { acknowledgments: outAck, customAnswers };
}
