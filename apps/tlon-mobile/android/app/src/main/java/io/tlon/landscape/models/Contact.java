package io.tlon.landscape.models;

import androidx.core.app.Person;

import org.json.JSONObject;

public class Contact {

    public String id;
    public String nickname;
    public String displayName;
    public String avatar;
    public String color;
    public Person person;

    public Contact(String id, JSONObject contactObject) {
        this.id = id;
        try {
            nickname = contactObject.getString("nickname");
        } catch (Exception ignored) {}
        try {
            avatar = contactObject.getString("avatar");
        } catch (Exception ignored) {}
        try {
            color = contactObject.getString("color");
        } catch (Exception ignored) {}

        if (nickname != null && !nickname.isBlank()) {
            displayName = nickname;
        } else {
            String deSigId = id.startsWith("~") ? id.replaceFirst("~", "") : id;
            if (deSigId.length() == 56) { // Comet
                displayName = "~" + deSigId.substring(0, 6) + "_" + deSigId.substring(51);
            } else if (deSigId.length() == 27) { // Moon
                displayName = "~" + deSigId.substring(14).replaceFirst("-", "^");
            } else {
                displayName = "~" + deSigId;
            }
        }

        person = new Person.Builder().setName(displayName).build();
    }

}
