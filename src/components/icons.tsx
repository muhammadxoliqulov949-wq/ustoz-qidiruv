import {
  Award,
  Code,
  FileText,
  Layers,
  Languages,
  MessagesSquare,
  PenTool,
  ScrollText,
  Sigma,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { CategoryIconKey } from "@/data/models";

/**
 * The single icon registry: data layers reference string keys, presentation
 * resolves them here. One library (lucide), one stroke language.
 */
export const categoryIcons: Record<CategoryIconKey, LucideIcon> = {
  languages: Languages,
  award: Award,
  sigma: Sigma,
  code: Code,
  scroll: ScrollText,
  pen: PenTool,
};

export type TrustIconKey = "file" | "layers" | "wallet" | "messages";

export const trustIcons: Record<TrustIconKey, LucideIcon> = {
  file: FileText,
  layers: Layers,
  wallet: Wallet,
  messages: MessagesSquare,
};
