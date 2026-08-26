"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useItProducts } from "@/hooks/use-it-products";

interface ItProjectProductPickerProps {
  value?: string;
  onChange: (productId: string) => void;
  disabled?: boolean;
}

const UNSET = "";

// Includes inactive products so an already-assigned (since-deactivated)
// product still shows correctly on an existing project's edit form — the
// backend is the actual enforcement point for "can't create/move into an
// inactive product" (it-project.service.ts), this just labels them clearly.
export function ItProjectProductPicker({
  value,
  onChange,
  disabled,
}: ItProjectProductPickerProps) {
  const { data: products, isLoading } = useItProducts(true);
  const options = products ?? [];

  return (
    <Select
      value={value ?? UNSET}
      onValueChange={(v) => v && onChange(v)}
      disabled={disabled || isLoading}
    >
      <SelectTrigger aria-label="Product" className="w-full">
        <SelectValue placeholder="Select a product">
          {(v: string) => {
            if (v === UNSET) return undefined;
            const product = options.find((p) => p._id === v);
            return product ? `${product.name}${product.isActive ? "" : " (Inactive)"}` : undefined;
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((p) => (
          <SelectItem key={p._id} value={p._id}>
            {p.name}
            {!p.isActive && " (Inactive)"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
