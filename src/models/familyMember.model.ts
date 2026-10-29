import mongoose, { Schema, Document, Types } from "mongoose";

export type Relation = "spouse" | "parent" | "child" | "sibling" | "other";

export interface IFamilyMember extends Document {
  userId: Types.ObjectId;
  name: string;
  relation: Relation;
  dateOfBirth?: Date | null;
  gender?: "M" | "F" | null;
  bloodGroup?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const FamilyMemberSchema = new Schema<IFamilyMember>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    relation: {
      type: String,
      enum: ["spouse", "parent", "child", "sibling", "other"],
      required: true,
    },
    dateOfBirth: { type: Date, default: null },
    gender: { type: String, enum: ["M", "F", null], default: null },
    bloodGroup: { type: String, default: null },
  },
  { timestamps: true }
);

export const FamilyMemberModel = mongoose.model<IFamilyMember>(
  "FamilyMember",
  FamilyMemberSchema
);
