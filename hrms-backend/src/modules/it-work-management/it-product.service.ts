import { ApiError } from "../../shared/errors/ApiError";
import { ACTIVITY_ACTIONS } from "../../shared/constants/activityActions";
import { recordActivity } from "../activity-log/activity-log.service";
import { toId } from "../../shared/utils/toId";
import { ITProductModel, IITProduct } from "./it-product.model";

const LABEL = "Product";

interface Actor {
  id: string;
  employeeId: string;
}

export function listItProducts(includeInactive: boolean) {
  const filter = includeInactive ? {} : { isActive: true };
  return ITProductModel.find(filter).sort({ name: 1 });
}

export async function createItProduct(
  actor: Actor,
  name: string,
  description?: string
): Promise<IITProduct> {
  const existing = await ITProductModel.findOne({ name });
  if (existing) {
    throw new ApiError(409, `${LABEL} "${name}" already exists`);
  }

  const product = await ITProductModel.create({
    name,
    description: description ?? null,
    isActive: true,
    createdBy: actor.id,
  });

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.IT_PRODUCT_CREATED,
    targetType: "ITProduct",
    targetId: toId(product),
    metadata: { name },
  });

  return product;
}

export async function updateItProduct(
  actor: Actor,
  id: string,
  name: string,
  description?: string
): Promise<IITProduct> {
  const product = await ITProductModel.findById(id);
  if (!product) {
    throw new ApiError(404, `${LABEL} not found`);
  }

  if (name !== product.name) {
    const existing = await ITProductModel.findOne({ name });
    if (existing) {
      throw new ApiError(409, `${LABEL} "${name}" already exists`);
    }
  }

  product.name = name;
  product.description = description ?? null;
  await product.save();

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.IT_PRODUCT_UPDATED,
    targetType: "ITProduct",
    targetId: toId(product),
    metadata: { name },
  });

  return product;
}

export async function setItProductActive(
  actor: Actor,
  id: string,
  isActive: boolean
): Promise<IITProduct> {
  const product = await ITProductModel.findByIdAndUpdate(id, { isActive }, { new: true });
  if (!product) {
    throw new ApiError(404, `${LABEL} not found`);
  }

  await recordActivity({
    actor,
    action: isActive
      ? ACTIVITY_ACTIONS.IT_PRODUCT_ACTIVATED
      : ACTIVITY_ACTIONS.IT_PRODUCT_DEACTIVATED,
    targetType: "ITProduct",
    targetId: toId(product),
    metadata: { isActive },
  });

  return product;
}
