# Tlon Messenger (TM)

Tlon Messenger is a new kind of messenger which you can fully control. The user ID is your cryptographic property, while all your data is stored in a single file, yours to keep and yours to take. With TM, you own a distinct node on the network, which you can use to host a community, a blog, or run any other computation. This repository contains the source code of the two main components of TM:

- TM client, which is available on iOS, Android and Desktop
- TM backend, which is deployed on the Urbit platform

## Client

The client is written in React Native. The mobile version is available on iOS and Android, while the desktop version is available via browser (with a desktop app planned soon for macOS, Linux, and Windows).

## Backend

The TM backend consists of a number of independent components, called agents.

### %groups

%groups allows creation of communities that aggregate distinct communication channels. Each group sets its own rules by defining user roles and the entry policy, and defines a set of channels available for group members to subscribe to.

### %channels

%channels facilitates communication between any number of parties by designating one node as the host. A channel can function as a group chat, a gallery or a notebook. Channels can be further customized with hooks, which allow you to program custom behaviours triggered by various channel events.

### %chat

%chat is a direct-message agent, which, unlike %channels, establishes peer-to-peer connection between two parties.

### %contacts
%contacts manages the user profile ands track connections to other users, constructing the user's social graph as they interact with others on the network.

### %activity

%activity is TM's activity tracker. It aggregates events sent by other agents and alerts the user based on his notification settings.

### %profile

%profile allows the user to expose a personal webpage accessible through their node's URL. The webpage can feature a preview of user's favorite groups or widgets registered by any other agents.

### %expose

%expose allows the user to publish the content available in one of the channels to the clearweb.
