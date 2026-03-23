/**
 * @param {object} user — User document (employer)
 * @param {object | null} company — EmployerProfile document or lean object
 */
export function computeEmployerCompletion(user, company) {
  let score = 0;
  if (user?.firstName) score += 10;
  if (user?.lastName) score += 10;
  if (user?.phone) score += 10;
  if (user?.jobTitle) score += 10;
  if (user?.isEmailVerified) score += 10;
  if (!company) return Math.min(score, 100);

  const c = company.companyDetails || {};
  if (c.companyName) score += 15;
  if (c.industryType) score += 10;
  if (c.companySize) score += 5;
  if (c.description) score += 10;
  const social = company.companySocialMedia || {};
  if (social.website) score += 5;
  const addr = company.address || {};
  if (addr.city || c.headquarters) score += 5;
  return Math.min(score, 100);
}
