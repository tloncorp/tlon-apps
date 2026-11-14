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

    /**
     * @param fallbackName shown when the contact has no nickname or nicknames
     *                     are hidden: the ship's number, computed by the
     *                     notification script. The ship name is never shown.
     */
    public Contact(String id, JSONObject contactObject, String fallbackName, boolean hideNicknames) {
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

        displayName = !hideNicknames && nickname != null && !nickname.isBlank()
                ? nickname
                : fallbackName;

        person = new Person.Builder().setName(displayName).build();
    }

}
