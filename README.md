# TM Tlon Messenger

Tlon Messenger is a new kind of messenger which you can fully control.
User ID is your cryptographic property, while all your data is stored in a single
file, yours to keep and yours to take. With TM, you own a distinct node on the
network, which you can use to host a community, a blog, or run any other computation.

This repository contains the source code of the two main components of TM:
- TM app, which is available on iOS, Android and Desktop.
- TM backend, which is deployed on the Urbit platform

## TM App

TM App is written in React Native. The mobile version is available on iOS and Android,
while desktop app is available on Linux, Mac and Windows.

## TM Backend

TM backend consists of a number of independent components, called
_agents_.

### %groups
%groups allow creation of communities that aggregate distinct
communication channels. Each group sets its own rules by defining user
roles and the entry policy, and defines a set of channels available for
groups members to subscribe to.

### %channels
%channels facilitate communication between any number of parties by
designating one node as the host. A channel can function as a group chat,
a gallery or a notebook. Channels can be further customized with TM Hooks, which
allow you to program custom behaviours triggered by various channel
events.

### %chat
%chat is a direct-message agent, which, unlinke %channels, establishes peer-to-peer connection
between two parties.

### %contacts
%contacts manage the user profile, and track connections to other
users, constructing the user's social graph as he interacts with others
on the TM network.

### %activity
%activity is TM's activity tracker. Activity aggregates events sent
by other agents and alerts the user based on his notification settings.

### %profile
%profile allows the user to expose a personal webpage accessible through
his node's URL. The webpage can feature preview of user's groups, or a
widget published by any other agent.

### %expose
%expose allows the user to publish the content available in one of the
channels to the clearweb.

---



