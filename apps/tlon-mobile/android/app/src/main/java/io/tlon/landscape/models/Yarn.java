package io.tlon.landscape.models;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Optional;

public class Yarn {

    public Boolean isValidNotification;
    public Boolean isGroup;
    public Boolean isClub;
    public String wer;
    public Optional<String> channelId;
    public Optional<String> groupId;
    public String senderId;
    public String contentText;

    public Yarn(JSONObject yarnObject) throws JSONException {
        JSONObject rope = yarnObject.getJSONObject("rope");
        String thread = rope.getString("thread");
        JSONArray content = yarnObject.getJSONArray("con");
        ArrayList<String> parts = new ArrayList<>();
        boolean skipNextPart = false;
        for (int i = 0; i < content.length(); i++) {
            if (skipNextPart) {
                skipNextPart = false;
                continue;
            }

            Object item = content.get(i);
            if (item instanceof JSONObject) {
                JSONObject itemObj = (JSONObject) item;
                if (itemObj.has("ship")) {
                    String ship = itemObj.getString("ship");
                    if (senderId == null) {
                        senderId = ship;
                    }
                } else if (itemObj.has("emph")) {
                    parts.add(itemObj.getString("emph"));
                }
            } else if (item instanceof String) {
                String text = (String) item;
                boolean isReply = text.equals(" replied to ") // DM replies
                        || text.equals(" replied to your message “"); // Backwards compatibility
                if (isReply
                    || text.equals(": ")
                    || text.equals("”: ")
                    || text.equals(" sent a message: ") // User has all notifications enabled
                    || text.equals(" replied to you: ") // Group replies, don't skip next
                    || text.equals(" mentioned you: ") // Mentions
                    || text.equals(" mentioned you:") // Backwards compatibility
                    || text.equals(" mentioned you :") // Backwards compatibility
                ) {
                    skipNextPart = isReply;
                    continue;
                }

                parts.add(text);
            }
        }

        isGroup = !rope.isNull("group");
        isValidNotification = rope.getString("desk").equals("groups") &&
                (!thread.endsWith("/channel/edit") &&
                !thread.endsWith("/channel/add") &&
                !thread.endsWith("/channel/del") &&
                !thread.endsWith("/joins") &&
                !thread.endsWith("/leaves") ||
                !isGroup);
        wer = yarnObject.getString("wer");
        groupId = !isGroup ? Optional.empty() :
                Optional.of(rope.getString("group"));
        channelId = isGroup ?
                rope.isNull("channel") ? Optional.empty() : Optional.of(rope.getString("channel"))
                : Optional.of(thread.replace("/dm/", "").replace("/club/", ""));
        isClub = channelId.isPresent() && channelId.get().startsWith("0v");
        contentText = String.join("", parts);
        if (senderId == null && channelId.isPresent() && channelId.get().startsWith("~")) {
            senderId = channelId.get();
        }
    }

}
