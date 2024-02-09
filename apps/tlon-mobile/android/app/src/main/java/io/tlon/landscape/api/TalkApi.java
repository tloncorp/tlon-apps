package io.tlon.landscape.api;

import android.content.Context;

import com.android.volley.DefaultRetryPolicy;
import com.android.volley.NetworkResponse;
import com.android.volley.Request;
import com.android.volley.RequestQueue;
import com.android.volley.Response;
import com.android.volley.VolleyError;
import com.android.volley.toolbox.HttpHeaderParser;
import com.android.volley.toolbox.JsonArrayRequest;
import com.android.volley.toolbox.JsonObjectRequest;
import com.android.volley.toolbox.Volley;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

import io.tlon.landscape.storage.SecureStorage;

public class TalkApi {

    private final RequestQueue queue;
    private int eventId = 1;

    public TalkApi(Context context) {
        queue = Volley.newRequestQueue(context);
    }

    public static JSONObject createPokePayload(String app, String mark, JSONObject json) throws JSONException {
        JSONObject payload = new JSONObject();
        payload.put("action", "poke");
        payload.put("app", app);
        payload.put("mark", mark);
        payload.put("json", json);
        return payload;
    }

    private void fetchObject(
            String path,
            int timeout,
            int maxRetries,
            TalkObjectCallback callback
    ) {
        String shipUrl = SecureStorage.getString(SecureStorage.SHIP_URL_KEY);
        String authCookie = SecureStorage.getString(SecureStorage.AUTH_COOKIE_KEY);
        if (shipUrl == null || authCookie == null) {
            callback.onComplete(null);
            return;
        }

        String url = shipUrl + path + ".json";
        JsonObjectRequest request = new JsonObjectRequest(
                Request.Method.GET,
                url,
                null,
                callback::onComplete,
                callback::onError
        ) {
            @Override
            public Map<String, String> getHeaders() {
                Map<String, String> params = new HashMap<>();
                params.put("Cookie", authCookie);
                return params;
            }
        };

        request.setRetryPolicy(new DefaultRetryPolicy(timeout, maxRetries, 1));
        queue.add(request);
    }

    private void fetchObject(String path, TalkObjectCallback callback) {
        fetchObject(path, 10_000, 3, callback);
    }

    private void putRequest(JSONObject payload) throws JSONException {
        String shipUrl = SecureStorage.getString(SecureStorage.SHIP_URL_KEY);
        String shipName = SecureStorage.getString(SecureStorage.SHIP_NAME_KEY);
        String authCookie = SecureStorage.getString(SecureStorage.AUTH_COOKIE_KEY);
        String channelUrl = SecureStorage.getString(SecureStorage.CHANNEL_URL);
        if (shipUrl == null || shipName == null || authCookie == null || channelUrl == null) {
            System.out.println("Skipping PUT request");
            return;
        }

        payload.put("id", eventId);
        payload.put("ship", shipName.replace("~", ""));

        JsonArrayRequest request = new JsonArrayRequest(
                Request.Method.PUT,
                channelUrl,
                new JSONArray().put(payload),
                null,
                System.out::println
        ) {
            @Override
            public Map<String, String> getHeaders() {
                Map<String, String> params = new HashMap<>();
                params.put("Cookie", authCookie);
                return params;
            }

            @Override
            protected Response<JSONArray> parseNetworkResponse(NetworkResponse response) {
                String json = new String(response.data, StandardCharsets.UTF_8);
                if (json.length() == 0) {
                    return Response.success(null, HttpHeaderParser.parseCacheHeaders(response));
                }

                return super.parseNetworkResponse(response);
            }
        };

        queue.add(request);
        eventId += 1;
    }

    private void poke(String app, String mark, JSONObject json) throws JSONException {
        putRequest(createPokePayload(app, mark, json));
    }

    public void fetchYarn(String uid, TalkObjectCallback callback) {
        fetchObject("/~/scry/hark/yarn/" + uid, 8_000, 3, callback);
    }

    public void fetchClub(String channelId, TalkObjectCallback callback) {
        fetchObject("/~/scry/chat/club/" + channelId + "/crew", callback);
    }

    public void fetchGroups(TalkObjectCallback callback) {
        fetchObject("/~/scry/groups/groups/light", callback);
    }

    public void fetchGroupChannel(String channelId, TalkObjectCallback callback) {
        fetchGroups(new TalkObjectCallback() {
            @Override
            public void onComplete(JSONObject response) {
                try {
                    Iterator<String> keys = response.keys();
                    while (keys.hasNext()) {
                        String key = keys.next();
                        JSONObject channels = response.getJSONObject(key).getJSONObject("channels");
                        if (channels.has(channelId)) {
                            callback.onComplete(channels.getJSONObject(channelId));
                            return;
                        }
                    }

                    callback.onComplete(null);
                } catch (JSONException e) {
                    callback.onComplete(null);
                }
            }

            @Override
            public void onError(VolleyError error) {
                callback.onError(error);
            }
        });
    }

    public void fetchContacts(TalkObjectCallback callback) {
        fetchObject("/~/scry/contacts/all", callback);
    }

    public void fetchContact(String id, TalkObjectCallback callback) {
        fetchContacts(new TalkObjectCallback() {
            @Override
            public void onComplete(JSONObject response) {
                try {
                    JSONObject contact = response.getJSONObject(id);
                    callback.onComplete(contact);
                } catch (JSONException e) {
                    callback.onComplete(null);
                }
            }

            @Override
            public void onError(VolleyError error) {
                callback.onError(error);
            }
        });
    }

    public void pokeChannelReadStatus(String id, boolean read) throws JSONException {
        JSONObject json = new JSONObject();
        json.put("whom", id);
        JSONObject diff = new JSONObject();
        if (read) {
            diff.put("read", JSONObject.NULL);
        } else {
            diff.put("unread", JSONObject.NULL);
        }
        json.put("diff", diff);
        poke("chat", "chat-remark-action", json);
    }

}
