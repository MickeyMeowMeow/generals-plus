/**
 * Represents a collection of message identifiers and their associated data.
 */
export type MessagePayload = object;

/**
 * Utility to extract keys from a `MessageMap` for type-safe messaging.
 */
export type ExtractMessageKey<T extends MessagePayload> = keyof T &
  (string | number);

export * from "#/messages/match";
export * from "#/messages/setup";
