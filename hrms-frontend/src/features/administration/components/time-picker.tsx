import { ClockTimePicker } from "@/components/ui/clock-time-picker";
import { Label } from "@/components/ui/label";

export function TimePicker({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <ClockTimePicker id={id} value={value} onChange={onChange} />
    </div>
  );
}
