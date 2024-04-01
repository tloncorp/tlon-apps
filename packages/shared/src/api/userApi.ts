import { poke } from "./urbit";

export const updateNickname = async (nickname: string) =>
  poke({
    app: "contacts",
    mark: "contact-action",
    json: {
      edit: [{ nickname }],
    },
  });

export const updateTelemetrySetting = async (isEnabled: boolean) =>
  poke({
    app: "settings",
    mark: "settings-event",
    json: {
      "put-entry": {
        desk: "groups",
        "bucket-key": "groups",
        "entry-key": "logActivity",
        value: isEnabled,
      },
    },
  });
