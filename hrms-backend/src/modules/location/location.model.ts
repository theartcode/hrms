import { Schema, model, Document } from "mongoose";

export interface ILocation extends Document {
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const locationSchema = new Schema<ILocation>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
);

export const LocationModel = model<ILocation>("Location", locationSchema);
