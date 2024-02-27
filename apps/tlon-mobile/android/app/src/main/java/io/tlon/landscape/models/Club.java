package io.tlon.landscape.models;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public class Club {

    public String id;
    public String displayName;

    public Club(String id, JSONObject clubObject) {
        this.id = id;

        JSONObject meta = null;
        try {
            meta = clubObject.getJSONObject("meta");
        } catch (Exception ignored) {}

        if (meta == null) {
            displayName = id;
        } else {
            String title = null;
            try {
                title = meta.getString("title");
            } catch (Exception ignored) {}

            if (title != null && !title.isBlank()) {
                displayName = title;
            } else {
                try {
                    JSONArray team = clubObject.getJSONArray("team");
                    JSONArray hive = clubObject.getJSONArray("hive");
                    List<String> users = new ArrayList<>();
                    for (int i = 0; i < team.length(); i++) {
                        users.add(team.getString(i));
                    }
                    for (int i = 0; i < hive.length(); i++) {
                        users.add(hive.getString(i));
                    }
                    displayName = String.join(", ", users); // TODO: get nicknames
                } catch (Exception ignored) {}
            }
        }
    }

}
