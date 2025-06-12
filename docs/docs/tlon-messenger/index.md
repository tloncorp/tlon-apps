# Tlon Messenger (TM)

Tlon Messenger is a new kind of messenger which you can fully control. The user
ID is your cryptographic property, while all your data is stored in a single
file, yours to keep and yours to take. 

With TM, you own a distinct node on the network, which you can use to host a
community, a blog, or run any other computation. This repository contains the
source code of the two main components of TM:

- TM client, which is available on iOS, Android and Desktop
- TM backend, which is deployed on the Urbit platform

## TM Client

The TM client is written in React Native. The mobile version is available on iOS
and Android, while the desktop version is available through a browser.

## TM Backend

The TM backend consists of a number of independent components, called agents.

### Groups

Groups agent manages TM groups. A TM group allows members to interact in
associated communication channels. Each group sets its own rules by defining
user roles and the entry policy.

### Channels

Channels agent facilitates communication between any number of parties by
designating one node as the host. A channel can function as a group chat, a
gallery, a notebook. Channels can be further customized with hooks, which allow
you to program custom behaviours triggered by various channel events.

### Chat

Chat agent is a direct-message agent, which, unlike Channels, establishes
peer-to-peer connection between the parties.

### Contacts

Contacts agent manages the user profile and track connections to other
users, constructing the user's social graph as he interact with others on the
network. This social graph is wholly owned by the user and never leaves the
device.


### Activity

Activity agent receives notifications from other components and alerts the user
based on the notification settings.

### Profile

Profile agent allows the user to expose a personal webpage accessible through their
node's URL. The webpage can feature a preview of user's favorite groups or
widgets registered by any other agents.

### Expose

Expose agent allows the user to publish the content available in one of the channels
to the clearweb.
