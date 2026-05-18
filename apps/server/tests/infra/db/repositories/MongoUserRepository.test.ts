import { GameMode } from "@generals-plus/engine";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IUserDocument } from "#/infra/db/models/user-model";
import { UserModel } from "#/infra/db/models/user-model";
import { MongoUserRepository } from "#/infra/db/repositories/MongoUserRepository";

describe("MongoUserRepository and UserModel tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("UserModel Schema Defaults and Validation (Offline)", () => {
    it("should populate correct defaults for ratings and boolean flags", async () => {
      const user = new UserModel({
        email: "test@example.com",
        password: "hashedpassword",
        displayName: "Test User",
      });

      // Mongoose built-in offline validation
      await user.validate();

      expect(user.anonymous).toBe(false);
      expect(user.verified).toBe(false);
      expect(user.ratings).toBeDefined();
      expect(user.ratings.classic).toBe(1000);
      expect(user.ratings.demolition).toBe(1000);
      expect(user.ratings.turf_war).toBe(1000);
      expect(user.ratings.biohazard).toBe(1000);
      expect(user.ratings.payload).toBe(1000);
      expect(user.ratings.rugby).toBe(1000);
      expect(user.ratings.collapse).toBe(1000);
      expect(user.ratings.domination).toBe(1000);
      expect(user.ratings.espionage).toBe(1000);
    });

    it("should trim email and displayName", async () => {
      const user = new UserModel({
        email: "  test@example.com  ",
        displayName: "  Test User  ",
      });

      await user.validate();

      expect(user.email).toBe("test@example.com");
      expect(user.displayName).toBe("Test User");
    });
  });

  describe("MongoUserRepository Operations", () => {
    const repository = new MongoUserRepository();

    describe("findByEmail", () => {
      it("should return the mapped user entity when user is found", async () => {
        const mockDoc = {
          _id: "60f7c1234567890123456789",
          email: "found@example.com",
          password: "hash",
          displayName: "Found User",
          anonymous: false,
          verified: true,
          ratings: { classic: 1200 },
        };

        const findOneSpy = vi.spyOn(UserModel, "findOne").mockReturnValue({
          exec: vi.fn().mockResolvedValue(mockDoc),
        } as unknown as never);

        const result = await repository.findByEmail("found@example.com");

        expect(findOneSpy).toHaveBeenCalledWith({ email: "found@example.com" });
        expect(result).toEqual({
          id: "60f7c1234567890123456789",
          email: "found@example.com",
          password: "hash",
          displayName: "Found User",
          anonymous: false,
          verified: true,
          ratings: { classic: 1200 },
        });
      });

      it("should return null when user is not found", async () => {
        const findOneSpy = vi.spyOn(UserModel, "findOne").mockReturnValue({
          exec: vi.fn().mockResolvedValue(null),
        } as unknown as never);

        const result = await repository.findByEmail("notfound@example.com");

        expect(findOneSpy).toHaveBeenCalledWith({
          email: "notfound@example.com",
        });
        expect(result).toBeNull();
      });
    });

    describe("createWithEmailAndPassword", () => {
      it("should create, save, and return the mapped user entity, excluding forbidden option overrides", async () => {
        const mockSavedDoc = {
          _id: "60f7c1234567890123456789",
          email: "new@example.com",
          password: "hashedpassword",
          displayName: "New User",
          anonymous: false,
          verified: false,
          ratings: { classic: 1000 },
        };

        let savedInstance: IUserDocument | null = null;
        const saveSpy = vi
          .spyOn(UserModel.prototype, "save")
          .mockImplementation(function (this: IUserDocument) {
            savedInstance = this;
            return Promise.resolve(mockSavedDoc as unknown as IUserDocument);
          });

        const result = await repository.createWithEmailAndPassword(
          "new@example.com",
          "hashedpassword",
          {
            displayName: "New User",
            email: "should_be_ignored@example.com",
            ratings: { classic: 2000 },
            anonymous: true,
            verified: true,
          },
        );

        expect(saveSpy).toHaveBeenCalled();
        expect(savedInstance).toBeDefined();
        // Check that options sanitization worked:
        expect(savedInstance?.email).toBe("new@example.com"); // constructor override parameter
        expect(savedInstance?.displayName).toBe("New User"); // safe option
        expect(savedInstance?.anonymous).toBe(false); // set to false directly
        expect(savedInstance?.verified).toBe(false); // set to false directly

        expect(result).toEqual({
          id: "60f7c1234567890123456789",
          email: "new@example.com",
          password: "hashedpassword",
          displayName: "New User",
          anonymous: false,
          verified: false,
          ratings: { classic: 1000 },
        });
      });
    });

    describe("createAnonymous", () => {
      it("should create, save, and return mapped anonymous user entity, excluding forbidden options", async () => {
        const mockSavedDoc = {
          _id: "60f7c123456789012345678a",
          anonymous: true,
          verified: false,
          ratings: { classic: 1000 },
        };

        let savedInstance: IUserDocument | null = null;
        const saveSpy = vi
          .spyOn(UserModel.prototype, "save")
          .mockImplementation(function (this: IUserDocument) {
            savedInstance = this;
            return Promise.resolve(mockSavedDoc as unknown as IUserDocument);
          });

        const result = await repository.createAnonymous({
          displayName: "Guest User",
          anonymous: false, // forbidden override
          verified: true, // forbidden override
        });

        expect(saveSpy).toHaveBeenCalled();
        expect(savedInstance).toBeDefined();
        expect(savedInstance?.displayName).toBe("Guest User");
        expect(savedInstance?.anonymous).toBe(true);
        expect(savedInstance?.verified).toBe(false);

        expect(result).toEqual({
          id: "60f7c123456789012345678a",
          email: undefined,
          password: undefined,
          displayName: undefined,
          anonymous: true,
          verified: false,
          ratings: { classic: 1000 },
        });
      });
    });

    describe("updatePassword", () => {
      it("should return true when update is acknowledged and matched", async () => {
        const updateOneSpy = vi.spyOn(UserModel, "updateOne").mockReturnValue({
          exec: vi.fn().mockResolvedValue({
            acknowledged: true,
            matchedCount: 1,
          }),
        } as unknown as never);

        const result = await repository.updatePassword(
          "test@example.com",
          "newhash",
        );

        expect(updateOneSpy).toHaveBeenCalledWith(
          { email: "test@example.com" },
          { password: "newhash" },
        );
        expect(result).toBe(true);
      });

      it("should return false when update is not matched", async () => {
        const updateOneSpy = vi.spyOn(UserModel, "updateOne").mockReturnValue({
          exec: vi.fn().mockResolvedValue({
            acknowledged: true,
            matchedCount: 0,
          }),
        } as unknown as never);

        const result = await repository.updatePassword(
          "missing@example.com",
          "newhash",
        );

        expect(updateOneSpy).toHaveBeenCalledWith(
          { email: "missing@example.com" },
          { password: "newhash" },
        );
        expect(result).toBe(false);
      });
    });

    describe("verifyEmail", () => {
      it("should return true when email verification modifies a document", async () => {
        const updateOneSpy = vi.spyOn(UserModel, "updateOne").mockReturnValue({
          exec: vi.fn().mockResolvedValue({
            modifiedCount: 1,
          }),
        } as unknown as never);

        const result = await repository.verifyEmail("test@example.com");

        expect(updateOneSpy).toHaveBeenCalledWith(
          { email: "test@example.com" },
          { verified: true },
        );
        expect(result).toBe(true);
      });

      it("should return false when no document is modified", async () => {
        const updateOneSpy = vi.spyOn(UserModel, "updateOne").mockReturnValue({
          exec: vi.fn().mockResolvedValue({
            modifiedCount: 0,
          }),
        } as unknown as never);

        const result = await repository.verifyEmail(
          "already-verified@example.com",
        );

        expect(updateOneSpy).toHaveBeenCalledWith(
          { email: "already-verified@example.com" },
          { verified: true },
        );
        expect(result).toBe(false);
      });
    });

    describe("getRating", () => {
      it("should return classic rating from database if it exists", async () => {
        const mockUser = {
          _id: "60f7c1234567890123456789",
          ratings: { classic: 1540 },
        };

        const findByIdSpy = vi.spyOn(UserModel, "findById").mockReturnValue({
          exec: vi.fn().mockResolvedValue(mockUser),
        } as unknown as never);

        const rating = await repository.getRating(
          "60f7c1234567890123456789",
          GameMode.CLASSIC,
        );

        expect(findByIdSpy).toHaveBeenCalledWith("60f7c1234567890123456789");
        expect(rating).toBe(1540);
      });

      it("should return default rating 1000 if game mode rating is not set", async () => {
        const mockUser = {
          _id: "60f7c1234567890123456789",
          ratings: {},
        };

        const findByIdSpy = vi.spyOn(UserModel, "findById").mockReturnValue({
          exec: vi.fn().mockResolvedValue(mockUser),
        } as unknown as never);

        const rating = await repository.getRating(
          "60f7c1234567890123456789",
          GameMode.CLASSIC,
        );

        expect(findByIdSpy).toHaveBeenCalledWith("60f7c1234567890123456789");
        expect(rating).toBe(1000);
      });

      it("should return default rating 1000 if user is not found", async () => {
        const findByIdSpy = vi.spyOn(UserModel, "findById").mockReturnValue({
          exec: vi.fn().mockResolvedValue(null),
        } as unknown as never);

        const rating = await repository.getRating(
          "missing-id",
          GameMode.CLASSIC,
        );

        expect(findByIdSpy).toHaveBeenCalledWith("missing-id");
        expect(rating).toBe(1000);
      });
    });

    describe("updateRatings", () => {
      it("should call bulkWrite with the formatted updates", async () => {
        const bulkWriteSpy = vi
          .spyOn(UserModel, "bulkWrite")
          .mockResolvedValue({} as unknown as never);

        const updates = [
          { userId: "user1", mode: GameMode.CLASSIC, newRating: 1050 },
          { userId: "user2", mode: GameMode.DEMOLITION, newRating: 980 },
        ];

        await repository.updateRatings(updates);

        expect(bulkWriteSpy).toHaveBeenCalledWith([
          {
            updateOne: {
              filter: { _id: "user1" },
              update: { $set: { "ratings.classic": 1050 } },
            },
          },
          {
            updateOne: {
              filter: { _id: "user2" },
              update: { $set: { "ratings.demolition": 980 } },
            },
          },
        ]);
      });
    });
  });
});
