interface ErrorAlertProps {
  message: string | null;
}

/** Conditional error message with alert role. */
export function ErrorAlert({ message }: ErrorAlertProps) {
  if (!message) return null;
  return (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}
