import { Schema, model, Document, Types } from "mongoose";

// Phase 1C-C: a single singleton document (same "key: singleton" pattern
// as the base HRMS's Configuration model) holding the list of employees
// granted read-only IT Work Management visibility — the CEO access
// mechanism. Modeled after Adobe License's own accessGrants array rather
// than inventing a new pattern; simpler than that one because read-only
// visibility has no permission levels to track, just membership.
export interface IITWorkManagementSettings extends Document {
  key: "singleton";
  readOnlyViewerIds: Types.ObjectId[];
}

const itWorkManagementSettingsSchema = new Schema<IITWorkManagementSettings>({
  key: { type: String, required: true, unique: true, default: "singleton" },
  readOnlyViewerIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
});

export const ITWorkManagementSettingsModel = model<IITWorkManagementSettings>(
  "ITWorkManagementSettings",
  itWorkManagementSettingsSchema
);
