import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    url: { type: String, trim: true },
    type: { type: String, trim: true },
  },
  { _id: false }
);

export default attachmentSchema;
