import { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/ApiResponse";
import * as itProductService from "./it-product.service";

async function list(req: Request, res: Response): Promise<void> {
  const { includeInactive } = req.validated!.query as { includeInactive: boolean };
  const products = await itProductService.listItProducts(includeInactive);
  sendSuccess(res, { products });
}

async function create(req: Request, res: Response): Promise<void> {
  const product = await itProductService.createItProduct(
    req.user!,
    req.body.name,
    req.body.description
  );
  sendSuccess(res, { product }, "Product created", 201);
}

async function update(req: Request, res: Response): Promise<void> {
  const product = await itProductService.updateItProduct(
    req.user!,
    String(req.params.id),
    req.body.name,
    req.body.description
  );
  sendSuccess(res, { product }, "Product updated");
}

async function activate(req: Request, res: Response): Promise<void> {
  const product = await itProductService.setItProductActive(
    req.user!,
    String(req.params.id),
    true
  );
  sendSuccess(res, { product }, "Product activated");
}

async function deactivate(req: Request, res: Response): Promise<void> {
  const product = await itProductService.setItProductActive(
    req.user!,
    String(req.params.id),
    false
  );
  sendSuccess(res, { product }, "Product deactivated");
}

export { list, create, update, activate, deactivate };
