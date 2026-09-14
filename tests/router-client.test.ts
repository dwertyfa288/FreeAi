import { expect, it } from "vitest";
import { RouterClient } from "../src/router-client.js";
import { MaintenanceModeError } from "../src/user-errors.js";

async function collect(source: AsyncIterable<unknown>): Promise<void> {
  for await (const _ of source) {}
}

it("recognizes maintenance response from the server", async () => {
  const client = new RouterClient("https://server.example", "token", async () => new Response(
    JSON.stringify({ code: "MAINTENANCE_MODE" }),
    { status: 503, headers: { "content-type": "application/json" } },
  ));

  await expect(collect(client.complete({ model: "auto", messages: [] }))).rejects.toBeInstanceOf(MaintenanceModeError);
});
