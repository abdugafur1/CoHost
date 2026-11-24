import { randomUUID } from "node:crypto";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { expect, test } from "@playwright/test";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import type { EventItem, UserProfile } from "../src/types";

const authOrigin = "http://127.0.0.1:9099";
test.use({ locale: "en-US" });

test("a student discovers the Computer Science club's self-defense class and requests to attend", async ({
  page,
}) => {
  test.setTimeout(60_000);

  const runId = randomUUID();
  const studentName = `Campus Student ${runId}`;
  const createdAt = new Date().toISOString();
  const classDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const club: UserProfile = {
    id: `computer-science-${runId}`,
    ownerId: `club-owner-${runId}`,
    name: "Computer Science Club",
    profileType: "organization",
    focus: "Technology",
    location: "North campus",
    description: "Campus Computer Science club.",
    createdAt,
  };
  const event: EventItem = {
    id: `self-defense-${runId}`,
    hostId: club.id,
    hostOwnerId: club.ownerId,
    hostName: club.name,
    hostProfileType: "organization",
    title: "Self-Defense Class",
    location: "Student Recreation Center",
    description: `An introductory self-defense class. Session reference ${runId}.`,
    audience: "everyone",
    dateOptions: [classDate],
    capacity: 20,
    attendees: 0,
    createdAt,
    publicationStatus: "published",
    collaborationRequirementsCompleted: true,
  };
  const emulator = await initializeTestEnvironment({
    projectId: "demo-cohost",
    firestore: { host: "127.0.0.1", port: 8080 },
  });
  let studentAccount: { localId: string; idToken: string } | undefined;
  let accountDeleteUrl: string | undefined;

  try {
    await emulator.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const batch = writeBatch(db);
      batch.set(doc(db, "userProfiles", club.id), club);
      batch.set(doc(db, "events", event.id), event);
      await batch.commit();
    });

    await page.goto("/");
    const accountButton = page.getByRole("button", { name: "Account", exact: true });
    await accountButton.click();
    const signUp = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.origin === authOrigin && url.pathname.endsWith("/accounts:signUp")
        && response.request().method() === "POST";
    });
    await page.getByRole("button", { name: "Continue without email" }).click();
    const signUpResponse = await signUp;
    expect(signUpResponse.ok()).toBe(true);
    const account: { localId: string; idToken: string } = await signUpResponse.json();
    studentAccount = account;
    accountDeleteUrl = signUpResponse.url().replace("/accounts:signUp", "/accounts:delete");
    await expect(
      page.getByText("Your device account is ready and profiles are synced.", { exact: true }),
    ).toBeVisible();

    await accountButton.click();
    await page.getByRole("button", { name: "Create New Profile" }).click();
    const form = page.getByRole("dialog", { name: "Create a Profile" });
    await form.getByLabel("Profile type").selectOption("student");
    await form.getByLabel("Your name").fill(studentName);
    await form.getByLabel("Profile location").fill("North campus");
    await form.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(`${studentName}'s student profile was created.`, {
      exact: true,
    })).toBeVisible();

    const navigation = page.getByRole("navigation", { name: "Main navigation" });
    await navigation.getByRole("button", { name: "dashboard", exact: true }).click();
    await expect(page.getByText("Student dashboard", { exact: true })).toBeVisible();
    const classCard = page.getByRole("article")
      .filter({ has: page.getByRole("heading", { name: event.title, exact: true }) })
      .filter({ hasText: event.description });
    await expect(classCard).toBeVisible();
    await expect(classCard.getByText(club.name, { exact: true })).toBeVisible();
    const dateLabel = new Date(`${classDate}T12:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    await classCard.getByRole("button", { name: `Select ${dateLabel}`, exact: true }).click();
    const message = "I would like to attend the introductory class.";
    await classCard.getByRole("textbox", { name: `Optional message for ${event.title}` })
      .fill(message);
    await classCard.getByRole("button", { name: "Send Participation Request", exact: true }).click();
    await expect(page.getByText(`Your participation request for ${event.title} has been sent.`, {
      exact: true,
    })).toBeVisible();

    await navigation.getByRole("button", { name: "requests", exact: true }).click();
    await page.getByRole("tab", { name: "Sent Requests" }).click();
    const sentRequest = page.getByRole("tabpanel", { name: "Sent Requests" }).getByRole("article")
      .filter({ has: page.getByText(event.title, { exact: true }) });
    await expect(sentRequest.getByText("pending", { exact: true })).toBeVisible();

    await emulator.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const profiles = await getDocs(query(
        collection(db, "userProfiles"), where("ownerId", "==", account.localId),
      ));
      expect(profiles.docs.map((profile) => profile.data())).toEqual([
        expect.objectContaining({ name: studentName, profileType: "student" }),
      ]);
      const requests = await getDocs(query(
        collection(db, "participationRequests"), where("eventId", "==", event.id),
      ));
      expect(requests.docs.map((entry) => entry.data())).toEqual([
        expect.objectContaining({
          requestType: "participation",
          eventId: event.id,
          eventTitle: event.title,
          hostOwnerId: club.ownerId,
          hostProfileId: club.id,
          requesterOwnerId: account.localId,
          requesterProfileId: profiles.docs[0].id,
          requesterName: studentName,
          requesterProfileType: "student",
          status: "pending",
          availableDates: [classDate],
          attendeeCount: 1,
          message,
        }),
      ]);
      expect((await getDoc(doc(db, "events", event.id))).data()?.attendees).toBe(0);
    });
  } finally {
    try {
      await emulator.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const batch = writeBatch(db);
        batch.delete(doc(db, "events", event.id));
        batch.delete(doc(db, "userProfiles", club.id));
        const requests = await getDocs(query(
          collection(db, "participationRequests"), where("eventId", "==", event.id),
        ));
        requests.forEach((entry) => batch.delete(entry.ref));
        if (studentAccount) {
          const profiles = await getDocs(query(
            collection(db, "userProfiles"), where("ownerId", "==", studentAccount.localId),
          ));
          profiles.forEach((profile) => batch.delete(profile.ref));
        }
        await batch.commit();
      });
    } finally {
      await emulator.cleanup();
      if (studentAccount && accountDeleteUrl) {
        const response = await fetch(accountDeleteUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: studentAccount.idToken }),
          signal: AbortSignal.timeout(5_000),
        });
        expect(response.ok).toBe(true);
      }
    }
  }
});
