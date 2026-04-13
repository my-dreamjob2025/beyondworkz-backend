/**
 * Employer company verification — admin must approve before posting jobs.
 * @param {object | null} profile — EmployerProfile doc or plain object
 */
export function employerCanPostJobs(profile) {
  if (!profile) return false;
  if (profile.verified === true && profile.profileStatus === "approved") return true;
  // Legacy accounts verified before profileStatus workflow used only `verified`
  if (profile.verified === true && profile.profileStatus === "pending") return true;
  return false;
}

/** Employer may not edit company profile or documents while a submission is in the admin queue. */
export function employerProfileEditLocked(profile) {
  return profile?.profileStatus === "pending_review";
}
