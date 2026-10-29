import mongoose, { Schema, Document, Types } from "mongoose";

export type ExpenseCategory = "consultation" | "medicine" | "test" | "other";

export interface IMedicalExpense extends Document {
  userId: Types.ObjectId;
  familyMemberId?: Types.ObjectId | null;
  prescriptionId?: Types.ObjectId | null;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  description: string;
  date: Date;
  note?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const MedicalExpenseSchema = new Schema<IMedicalExpense>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    familyMemberId: { type: Schema.Types.ObjectId, ref: "FamilyMember", default: null },
    prescriptionId: { type: Schema.Types.ObjectId, ref: "Prescription", default: null },
    category: {
      type: String,
      enum: ["consultation", "medicine", "test", "other"],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "BDT" },
    description: { type: String, required: true },
    date: { type: Date, required: true, index: true },
    note: { type: String, default: null },
  },
  { timestamps: true }
);

MedicalExpenseSchema.index({ userId: 1, date: -1 });
MedicalExpenseSchema.index({ userId: 1, category: 1, date: -1 });

export const MedicalExpenseModel = mongoose.model<IMedicalExpense>(
  "MedicalExpense",
  MedicalExpenseSchema
);
