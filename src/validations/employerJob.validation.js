import Joi from "joi";

const JOB_TYPES = ["Full Time", "Part Time", "Contract", "Internship"];
const SALARY_TYPES = ["Fixed Salary", "Salary Range", "Commission Based"];
const SALARY_PERIODS = ["Per Month", "Per Year"];
const LISTING_TYPES = ["standard", "featured"];

const screeningSchema = Joi.object({
  experience: Joi.boolean(),
  locationComfort: Joi.boolean(),
  immediateJoin: Joi.boolean(),
  salaryComfort: Joi.boolean(),
  customQuestions: Joi.array().items(Joi.string().trim().max(500)).max(25),
  preferredExperience: Joi.string().allow("", null),
  preferredEducation: Joi.string().allow("", null),
  autoShortlist: Joi.boolean(),
});

const benefitsSchema = Joi.object({
  healthInsurance: Joi.boolean(),
  travelAllowance: Joi.boolean(),
  pf: Joi.boolean(),
  esi: Joi.boolean(),
  incentives: Joi.boolean(),
});

const bonusesSchema = Joi.object({
  performance: Joi.boolean(),
  joining: Joi.boolean(),
  commission: Joi.boolean(),
});

const basePayload = {
  hiringFor: Joi.string().allow("", null),
  title: Joi.string().allow("", null),
  jobType: Joi.string().valid(...JOB_TYPES),
  openings: Joi.number().integer().min(1).max(9999),
  city: Joi.string().allow("", null),
  area: Joi.string().allow("", null),
  description: Joi.string().allow("", null),
  responsibilities: Joi.string().allow("", null),
  skills: Joi.array().items(Joi.string().trim().max(80)).max(40),
  minExperience: Joi.string().allow("", null),
  education: Joi.string().allow("", null),
  salaryType: Joi.string().valid(...SALARY_TYPES),
  minSalary: Joi.string().allow("", null),
  maxSalary: Joi.string().allow("", null),
  salaryPeriod: Joi.string().valid(...SALARY_PERIODS),
  benefits: benefitsSchema,
  bonuses: bonusesSchema,
  screening: screeningSchema,
  listingType: Joi.string().valid(...LISTING_TYPES),
  status: Joi.string().valid("draft", "published"),
};

export const draftJobSchema = Joi.object({
  ...basePayload,
  status: Joi.string().valid("draft").required(),
});

export const publishJobSchema = Joi.object({
  hiringFor: Joi.string().trim().min(1).max(200).required(),
  title: Joi.string().trim().min(2).max(120).required(),
  jobType: Joi.string()
    .valid(...JOB_TYPES)
    .required(),
  openings: Joi.number().integer().min(1).max(9999).required(),
  city: Joi.string().trim().min(1).max(80).required(),
  area: Joi.string().trim().min(1).max(120).required(),
  description: Joi.string().trim().min(20).max(20000).required(),
  responsibilities: Joi.string().trim().min(10).max(20000).required(),
  skills: Joi.array().items(Joi.string().trim().min(1).max(80)).min(1).max(40).required(),
  minExperience: Joi.string().trim().min(1).max(120).required(),
  education: Joi.string().trim().min(1).max(120).required(),
  salaryType: Joi.string()
    .valid(...SALARY_TYPES)
    .required(),
  minSalary: Joi.string().trim().max(20).required(),
  maxSalary: Joi.string().trim().max(20).required(),
  salaryPeriod: Joi.string()
    .valid(...SALARY_PERIODS)
    .required(),
  benefits: benefitsSchema.required(),
  bonuses: bonusesSchema.required(),
  screening: screeningSchema.required(),
  listingType: Joi.string().valid(...LISTING_TYPES).default("standard"),
  status: Joi.string().valid("published").required(),
});

export const patchStatusSchema = Joi.object({
  status: Joi.string().valid("closed", "published", "draft").required(),
});

export function validateSchema(schema, body) {
  const { error, value } = schema.validate(body, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    const message = error.details.map((d) => d.message.replace(/"/g, "")).join("; ");
    return { error: message };
  }
  return { value };
}
