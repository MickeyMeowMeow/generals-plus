/**
 * User entity representing the core data structure.
 */
export interface IUser {
  id: string; // Mongoose _id as string
  email?: string;
  password?: string; // Hashed password
  anonymous?: boolean;
  verified?: boolean;
  elo?: number; // Player's ranking score
}

/**
 * Repository interface for User Database operations.
 * Decouples the Auth logic from the specific database implementation (MongoDB).
 */
export interface IUserRepository {
  findByEmail(email: string): Promise<IUser | null>;
  createWithEmailAndPassword(
    email: string,
    passwordHash: string,
    options?: any,
  ): Promise<IUser>;
  createAnonymous(options?: any): Promise<IUser>;
  updatePassword(email: string, newPasswordHash: string): Promise<boolean>;
  verifyEmail(email: string): Promise<boolean>;
}
