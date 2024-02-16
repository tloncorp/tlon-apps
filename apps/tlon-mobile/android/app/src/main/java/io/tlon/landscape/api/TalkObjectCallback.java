package io.tlon.landscape.api;

import com.android.volley.VolleyError;

import org.json.JSONObject;

public interface TalkObjectCallback {

    void onComplete(JSONObject response);

    void onError(VolleyError error);

}