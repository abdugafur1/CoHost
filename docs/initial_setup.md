The idea behind this app, CoHost, is for students and organizations to organize activities together. For example, the Taekwondo Club can host a self-defense workshop, choose available dates and a location, and accept requests from clubs or individual students.

The app should be built using React and TypeScript, and it should use Firebase for backend services. The app should be hosted on Firebase. Let people continue without an email address; restore their account on the same browser/device and associate their profiles with that account. The interface should not describe this as anonymous sign-in.

Users create a profile and identify as either a student or an organization. Profiles should include a display name, area of interest, location, and description. An organization can post events with a start and end date selected from a calendar, location, capacity, and an audience setting: everyone (students and organizations) or organizations only. Event participants can select their available dates from a calendar.

Students requesting to join an event are identified as students and request one spot. Organizations can state how many people they are bringing. Both can choose available dates and include a message with their request. Event hosts should be able to tell whether each request came from a student or an organization.

Implement an inbox system where users can receive notifications about event requests they sent or received.

The app should start with no sample profiles, events, or notifications. Show empty states until users create profiles and post or request events.

Store profiles and events in Firestore. Profiles belong to the account that created them. Events are shared and should appear in real time across browsers and devices. Keep event listings publicly readable, and limit profile and request access to their owners and event hosts.



When calling firebase init, do not enable functions, Github Actions, or app hosting.

Use the following Firebase configuration data:

{
  apiKey: "AIzaSyCrxQ7KdAax8uNwRzP81sCHJXqcb3tCF1s",
  authDomain: "cohost-8fdc0.firebaseapp.com",
  projectId: "cohost-8fdc0",
  storageBucket: "cohost-8fdc0.firebasestorage.app",
  messagingSenderId: "824086265811",
  appId: "1:824086265811:web:0c273254f988ba9cd17926"
};