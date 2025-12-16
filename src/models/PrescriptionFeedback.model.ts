import mongoose, { Schema, Document, Types } from "mongoose";

export interface IPrescriptionFeedback extends Document {
  userId: Types.ObjectId;
  prescriptionId: Types.ObjectId;
  
  // Health condition rating (1-5)
  overallImprovement: number;
  symptomRelief: number;
  medicationEffectiveness: number;
  sideEffects: number; // 1 = severe, 5 = none
  
  // Text feedback
  healthConditionNow: string; // How do you feel now?
  wasHelpful: boolean; // Did this treatment help?
  sideEffectsDescription?: string;
  additionalComments?: string;
  
  // Would recommend
  wouldRecommend: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

const PrescriptionFeedbackSchema = new Schema<IPrescriptionFeedback>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    prescriptionId: {
      type: Schema.Types.ObjectId,
      ref: "Prescription",
      required: true,
      unique: true, // One feedback per prescription
      index: true,
    },
    
    // Ratings (1-5 scale)
    overallImprovement: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    symptomRelief: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    medicationEffectiveness: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    sideEffects: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    
    // Text responses
    healthConditionNow: {
      type: String,
      required: true,
    },
    wasHelpful: {
      type: Boolean,
      required: true,
    },
    sideEffectsDescription: {
      type: String,
      default: null,
    },
    additionalComments: {
      type: String,
      default: null,
    },
    
    wouldRecommend: {
      type: Boolean,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
PrescriptionFeedbackSchema.index({ userId: 1, createdAt: -1 });

export const PrescriptionFeedbackModel = mongoose.model<IPrescriptionFeedback>(
  "PrescriptionFeedback",
  PrescriptionFeedbackSchema
);