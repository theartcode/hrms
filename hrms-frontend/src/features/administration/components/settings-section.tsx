import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SettingsSection({
  title,
  description,
  contentClassName,
  children,
}: {
  title: string;
  description?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className={cn("flex flex-col gap-4", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
