import { expect, test } from "vitest";

import { toClientContact, toClientContacts } from "./contactsApi";

const inputContact: [string, any] = [
  "test",
  {
    status: "listening to music",
    avatar: null,
    cover:
      "https://20-urbit.s3.us-west-1.amazonaws.com/ravmel-ropdyl/2021.2.13..00.31.09-Manaslu-crevasses.jpg",
    bio: "happy to chat, send a dm any time",
    nickname: "galen",
    color: "0xff.ffff",
    groups: [
      "~ravmel-ropdyl/audio-video-images",
      "~nibset-napwyn/tlon",
      "~ravmel-ropdyl/crate",
    ],
  },
];

const outputContact = {
  id: "test",
  avatarImage: null,
  coverImage:
    "https://20-urbit.s3.us-west-1.amazonaws.com/ravmel-ropdyl/2021.2.13..00.31.09-Manaslu-crevasses.jpg",
  bio: "happy to chat, send a dm any time",
  nickname: "galen",
  status: "listening to music",
  color: "#ffffff",
  pinnedGroupIds: [
    "~ravmel-ropdyl/audio-video-images",
    "~nibset-napwyn/tlon",
    "~ravmel-ropdyl/crate",
  ],
};

test("converts a contact from server to client format", () => {
  expect(toClientContact(...inputContact)).toStrictEqual(outputContact);
});

test("converts an array of contacts from server to client format", () => {
  expect(
    toClientContacts({ [inputContact[0]]: inputContact[1] })
  ).toStrictEqual([outputContact]);
});
