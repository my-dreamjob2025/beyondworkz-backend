import { BUCKET, getPresignedViewUrl } from "../config/s3.config.js";

const API_BASE = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5001}`;

function isLocalResume(resume) {
  if (!resume?.url) return !BUCKET;
  return (
    resume.url.includes("/uploads/") ||
    resume.url.startsWith(API_BASE) ||
    (resume.url.startsWith("http") && !resume.url.includes("s3") && (!BUCKET || !resume.url.includes(BUCKET)))
  );
}

/**
 * Safe resume URL for an employer viewing an applicant (presigned S3 or local public URL).
 */
export async function getResumeDownloadForEmployer(profile) {
  const resume = profile?.whiteCollarDetails?.resume;
  if (!resume?.key) return null;

  if (isLocalResume(resume)) {
    let url = resume.url;
    if (!url || !url.startsWith("http")) {
      url = `${API_BASE.replace(/\/$/, "")}/uploads/${String(resume.key).replace(/^\//, "")}`;
    }
    return {
      url,
      fileName: resume.key.split("/").pop() || "resume.pdf",
      contentType: resume.contentType || "application/pdf",
      expiresIn: null,
    };
  }

  const url = await getPresignedViewUrl(resume.key, 3600);
  if (!url) return null;
  return {
    url,
    fileName: resume.key.split("/").pop() || "resume.pdf",
    contentType: resume.contentType || "application/pdf",
    expiresIn: 3600,
  };
}

function formatExperienceRow(exp) {
  if (!exp) return null;
  return {
    id: exp._id,
    jobTitle: exp.jobTitle,
    company: exp.company,
    dateOfJoining: exp.dateOfJoining,
    relievingDate: exp.relievingDate,
    current: exp.current,
    location: exp.location,
    description: exp.description,
    noticePeriod: exp.noticePeriod,
    skillsUsed: Array.isArray(exp.skillsUsed) ? exp.skillsUsed : [],
  };
}

function formatEducationRow(ed) {
  if (!ed) return null;
  return {
    id: ed._id,
    level: ed.level,
    degree: ed.degree,
    institution: ed.institution,
    boardOrUniversity: ed.boardOrUniversity,
    fieldOfStudy: ed.fieldOfStudy,
    startDate: ed.startDate,
    endDate: ed.endDate,
    gradeOrPercentage: ed.gradeOrPercentage,
    currentlyStudying: ed.currentlyStudying,
  };
}

/**
 * Subset of employee profile for employer review (no sensitive internal fields).
 */
export function formatCandidateProfileForEmployer(profile) {
  if (!profile) return null;

  const skills = Array.isArray(profile.skills)
    ? profile.skills.map((s) => (typeof s?.name === "string" ? s.name : "")).filter(Boolean)
    : [];

  const base = {
    employeeType: profile.employeeType || null,
    location: profile.location || "",
    availability: profile.availability || null,
    whatsappNumber: profile.whatsappNumber || "",
    skills,
  };

  if (profile.employeeType === "blue_collar" && profile.blueCollarDetails) {
    const b = profile.blueCollarDetails;
    return {
      ...base,
      blueCollar: {
        hasVehicleWashingExperience: b.hasVehicleWashingExperience,
        hasBikeOrScooty: b.hasBikeOrScooty,
        hasDrivingLicense: b.hasDrivingLicense,
        preferredAreas: Array.isArray(b.preferredAreas) ? b.preferredAreas : [],
      },
    };
  }

  const wc = profile.whiteCollarDetails || {};
  const experience = Array.isArray(profile.experience)
    ? profile.experience.slice(0, 8).map(formatExperienceRow).filter(Boolean)
    : [];
  const education = Array.isArray(profile.education)
    ? profile.education.slice(0, 8).map(formatEducationRow).filter(Boolean)
    : [];
  const projects = Array.isArray(wc.projects)
    ? wc.projects.slice(0, 6).map((p) => ({
        title: p.title,
        description: p.description,
        technologies: Array.isArray(p.technologies) ? p.technologies : [],
        liveUrl: p.liveUrl,
        githubUrl: p.githubUrl,
        startDate: p.startDate,
        endDate: p.endDate,
      }))
    : [];

  return {
    ...base,
    headline: wc.resumeHeadline || "",
    bio: wc.bio || "",
    linkedin: wc.linkedin || "",
    github: wc.github || "",
    portfolio: wc.portfolio || "",
    totalExperienceYears: typeof wc.totalExperienceYears === "number" ? wc.totalExperienceYears : null,
    totalExperienceMonths: typeof wc.totalExperienceMonths === "number" ? wc.totalExperienceMonths : null,
    experience,
    education,
    projects,
    certifications: Array.isArray(wc.certifications)
      ? wc.certifications.slice(0, 10).map((c) => ({
          name: c.name,
          issuingOrganization: c.issuingOrganization,
          issueDate: c.issueDate,
          expiryDate: c.expiryDate,
          credentialUrl: c.credentialUrl,
        }))
      : [],
  };
}
