import { beforeEach, describe, expect, it, vi } from "vitest";

const configureClient = vi.fn();
const authenticate = vi.fn();
const createHttpPokeApi = vi.fn();
const urbitFetch = vi.fn();

vi.mock("@tloncorp/api", () => ({
  configureClient,
}));

vi.mock("./auth.js", () => ({
  authenticate,
}));

vi.mock("./http-poke.js", () => ({
  createHttpPokeApi,
}));

vi.mock("./fetch.js", () => ({
  urbitFetch,
}));

describe("api client shim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes shipUrl through on the injected client shim", async () => {
    const { configureTlonApiWithPoke } = await import("./api-client.js");

    const poke = vi.fn();
    configureTlonApiWithPoke(poke, "~zod", "http://ships:8080");

    expect(configureClient).toHaveBeenCalledWith(
      expect.objectContaining({
        shipName: "zod",
        shipUrl: "http://ships:8080",
        client: expect.objectContaining({
          url: "http://ships:8080",
          nodeId: "",
        }),
      }),
    );
  });

  it("configures the authenticated shim with url for server-side upload helpers", async () => {
    authenticate.mockResolvedValue("cookie");
    createHttpPokeApi.mockResolvedValue({
      poke: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
    });
    urbitFetch.mockResolvedValue({
      response: {
        ok: true,
        json: () => Promise.resolve({}),
      },
      release: vi.fn().mockResolvedValue(undefined),
    });

    const { withAuthenticatedTlonApi } = await import("./api-client.js");

    await withAuthenticatedTlonApi(
      {
        url: "http://ships:8080",
        code: "lidlut-tabwed-pillex-ridrup",
        ship: "~zod",
      },
      async () => "ok",
    );

    expect(configureClient).toHaveBeenCalledWith(
      expect.objectContaining({
        shipName: "zod",
        shipUrl: "http://ships:8080",
        client: expect.objectContaining({
          url: "http://ships:8080",
        }),
      }),
    );
  });
});
