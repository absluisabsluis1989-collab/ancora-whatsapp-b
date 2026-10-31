import { createFileRoute } from "@tanstack/react-router";
import { PainelFrame } from "@/components/ancora/shell";

export const Route = createFileRoute("/painel")({
  component: PainelFrame,
});
