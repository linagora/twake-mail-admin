import { afterEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("@/lib/apiClient", () => ({ apiClient: client }));

import { createRegisteredUser, deleteRegisteredUser, getRegisteredUsers, updateRegisteredUser } from "./api-client";

const forbidden = Object.assign(new Error("Forbidden"), { response: { status: 403 } });

afterEach(() => vi.resetAllMocks());

describe("registered users api client", () => {
  it("only calls the domain-scoped routes for a domain administrator", async () => {
    client.get.mockResolvedValue([]);
    await getRegisteredUsers("a.com");
    await createRegisteredUser({ id: "u@a.com", email: "u@a.com" } as never, "a.com");
    await updateRegisteredUser("42", { firstname: "U" }, "a.com");
    await deleteRegisteredUser("u@a.com", "a.com");
    expect(client.get).toHaveBeenCalledWith("/domains/a.com/registeredUsers");
    expect(client.post).toHaveBeenCalledWith("/domains/a.com/registeredUsers", expect.anything());
    expect(client.patch).toHaveBeenCalledWith("/domains/a.com/registeredUsers?id=42", { firstname: "U" });
    expect(client.delete).toHaveBeenCalledWith("/domains/a.com/registeredUsers?email=u%40a.com");
  });

  it("surfaces a refusal of the domain-scoped route instead of falling back to the global one", async () => {
    client.get.mockRejectedValue(forbidden);
    client.delete.mockRejectedValue(forbidden);
    await expect(getRegisteredUsers("a.com")).rejects.toBe(forbidden);
    await expect(deleteRegisteredUser("victim@b.com", "a.com")).rejects.toBe(forbidden);
    expect(client.get).toHaveBeenCalledTimes(1);
    expect(client.delete).toHaveBeenCalledTimes(1);
    expect(client.get).not.toHaveBeenCalledWith("/registeredUsers");
    expect(client.delete).not.toHaveBeenCalledWith("/registeredUsers?email=victim%40b.com");
  });

  it("uses the global routes in GLOBAL mode", async () => {
    client.get.mockResolvedValue([]);
    await getRegisteredUsers();
    await deleteRegisteredUser("u@b.com");
    expect(client.get).toHaveBeenCalledWith("/registeredUsers");
    expect(client.delete).toHaveBeenCalledWith("/registeredUsers?email=u%40b.com");
  });
});
