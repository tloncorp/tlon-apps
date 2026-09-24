package io.tlon.landscape.api;

public interface TalkPokeCallback {

    /**
     * @param succeeded whether the ship accepted the poke. False when the
     *                  request failed outright or the app has no stored
     *                  session to poke with.
     */
    void onComplete(boolean succeeded);

}
