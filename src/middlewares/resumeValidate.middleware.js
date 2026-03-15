import Joi from "joi";
import { sendResponse } from "../utils/response.js";

export const presignSchema = Joi.object({
  fileName: Joi.string().min(1).max(255).required(),
  contentType: Joi.string().required(),
  fileSize: Joi.number().integer().min(1).optional(),
});

export function validateResumeBody(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return sendResponse(res, 400, false, {
        message: error.details.map((d) => d.message).join(", "),
      });
    }
    next();
  };
}
