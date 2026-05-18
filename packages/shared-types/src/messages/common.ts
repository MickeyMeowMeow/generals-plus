export type ToastSeverity = "info" | "warning" | "error" | "success";

export interface ToastMessage {
  message: string;
  severity: ToastSeverity;
}
