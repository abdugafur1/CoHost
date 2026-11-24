import { expect, test, type Page } from "@playwright/test";

async function publishClubProfile(page: Page, name: string, resource: string) {
  await page.goto("/");

  const accountButton = page.getByRole("button", {
    name: "Account",
    exact: true,
  });

  await accountButton.click();
  await page.getByRole("button", { name: "Continue without email" }).click();
  await expect(
    page.getByText("Your device account is ready and profiles are synced.", {
      exact: true,
    }),
  ).toBeVisible();

  await accountButton.click();
  await page.getByRole("button", { name: "Create New Profile" }).click();

  const form = page.getByRole("dialog", { name: "Create a Profile" });
  await form.getByLabel("Profile type").selectOption("organization");
  await form.getByLabel("Organization name").fill(name);
  await form.getByLabel("Profile location").fill("North campus");
  await form.getByRole("button", { name: "Save", exact: true }).click();

  await expect(
    page.getByText(`${name}'s organization profile was created.`, {
      exact: true,
    }),
  ).toBeVisible();

  await accountButton.click();
  await page.getByRole("button", { name: "Edit Profile", exact: true }).click();

  const editor = page.getByRole("region", { name: "Edit Profile" });
  await editor.getByRole("checkbox", { name: resource, exact: true }).check();
  await editor
    .getByRole("checkbox", { name: /Show in Discover Clubs/ })
    .check();
  await editor.getByRole("button", { name: "Save Changes" }).click();

  await expect(
    page.getByText(`${name}'s profile has been updated.`, { exact: true }),
  ).toBeVisible();
}

test("an organization can find AI Club by filtering for Technical Support", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(60_000);

  // Given AI Club offers Technical Support and Tennis Club offers a venue.
  const aiClubPage = await browser.newPage({ baseURL });
  try {
    await publishClubProfile(aiClubPage, "AI Club", "Technical Support");
  } finally {
    await aiClubPage.close();
  }

  await publishClubProfile(page, "Tennis Club", "Event Venue");
  await page
    .getByRole("button", { name: "Discover Clubs", exact: true })
    .click();

  const directory = page.getByRole("region", { name: "Discover Clubs" });
  const aiClub = directory.getByRole("heading", {
    name: "AI Club",
    exact: true,
  });
  const tennisClub = directory.getByRole("heading", {
    name: "Tennis Club",
    exact: true,
  });

  await expect(aiClub).toBeVisible();
  await expect(tennisClub).toBeVisible();

  // When Tennis Club filters the directory by Technical Support.
  await directory
    .getByRole("combobox", { name: "Filter by resource" })
    .selectOption({ label: "Technical Support" });

  // Then AI Club remains visible and Tennis Club is filtered out.
  await expect(aiClub).toBeVisible();
  await expect(tennisClub).toHaveCount(0);
});
