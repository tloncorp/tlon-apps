# Channels
## Table of Contents
 - [Introduction](#introduction)
 - [Scries](#scries)
 - [Pokes](#pokes)
 - [Subscriptions](#Subscriptions)

## Introduction
This document covers the scries, pokes, and subscriptions for Tlon's chat, notebook, and gallery channel backend. 

### Agents
Tlon's channels are implemented through two agents, `%channels` and `%channels-server`. These both communicate with each other, and `%channels` also communicates with frontends and third-party agents.

`%channels-server` is intended for internal use by `%channels`. As such, we will not be elaborating on its API here.

`%channels`, on the other hand, is there precisely to facilitate use by frontend clients and third-party agents. Its API is made up primarily of two types:

Actions describe user actions, like creating a channel or sending a message. Actions types are prefixed with `$a-`.
Responses describe changes made to channels. Response types are prefixed with `$r-`

### Code examples
To use these code examples in the dojo, import the types with `=c -build-file /=groups=/sur/channel/hoon`

To use these code examples in an agent, replace any instance of`/=groups=` with `/(scot %p our.bowl)/groups/(scot %da now.bowl)` and import the types with `/-  c=channel`

You'll also need a group to put channels in. Use this code snippet in your dojo to create one:

```hoon
=g -build-file /=groups=/sur/groups/hoon

=create :*
  name=%mygroup
  title='My group'
  description='This is my group'
  image=''
  cover=''
  cordon=`cordon:g`[%open ban=[ships=~ ranks=~]]
  members=`(jug ship sect:g)`(~(put ju *(jug ship sect:g)) our %admin)
  secret=%.n
  ==

:groups &group-create create
```
## Scries
| Path | Mark | Description | Example
|------|------|-------------|--------
| `/x/channels` | [channel-channels](https://github.com/tloncorp/landscape-apps/blob/develop/desk/mar/channel/channels.hoon) | Get known channels and their contents. Returns [$channels](https://github.com/tloncorp/landscape-apps/blob/develop/desk/sur/channels.hoon#L407) | <code>.^(channels:c %gx /=channels=/channels/channel-channels)</code>
| `/x/unreads` | [channel-unreads](https://github.com/tloncorp/landscape-apps/blob/develop/desk/mar/channel/unreads.hoon) | Get unread information for the channels our ship is in. Returns [$unreads](https://github.com/tloncorp/landscape-apps/blob/develop/desk/sur/channels.hoon#L218) | <code>.^(unreads:c %gx /=channels=/unreads/channel-unreads)</code>
| `/x/init` | noun | Combination of `/channels` and `/unreads`. Returns [[$unreads](https://github.com/tloncorp/landscape-apps/blob/develop/desk/sur/channels.hoon#L218) [$channels](https://github.com/tloncorp/landscape-apps/blob/develop/desk/sur/channels.hoon#L407)] | <code>.^([unreads:c channels:c] %gx /=channels=/init/noun)</code>
| `/x/pins` | [channel-pins](https://github.com/tloncorp/landscape-apps/blob/develop/desk/mar/channel/pins.hoon) | Get pinned channels. Returns (list [$nest](https://github.com/tloncorp/landscape-apps/blob/develop/desk/sur/channels.hoon#L184)) | <code>.^((list nest:c) %gx /=channels=/pins/channel-pins)</code>
| `/x/[kind]/[ship]/[name]/perm` | [channel-perm](https://github.com/tloncorp/landscape-apps/blob/develop/desk/mar/channel/perm.hoon) | Get permissions for a channel. Returns [$perm](https://github.com/tloncorp/landscape-apps/blob/develop/desk/sur/channels.hoon#L227) | <code>.^(perm:c %gx /=channels=/chat/~sampel-palnet/mychat/perm/channel-perm)</code>
| `/x/[kind]/[ship]/[name]/search/text/[skip=@]/[count=@]/[nedl=@]` | [channel-scan](https://github.com/tloncorp/landscape-apps/blob/develop/desk/mar/channel/scan.hoon) | Search for text. Returns [$scan](https://github.com/tloncorp/landscape-apps/blob/develop/desk/sur/channels.hoon#L195) | <code>.^(scan:c %gx /=channels=/chat/~sampel-palnet/mychat/search/text/0/10/'foo bar')</code>
| `/x/[kind]/[ship]/[name]/search/mention/[skip=@]/[count=@]/[nedl=@]` | [channel-scan](https://github.com/tloncorp/landscape-apps/blob/develop/desk/mar/channel/scan.hoon) | Search for a mention. Returns [$scan](https://github.com/tloncorp/landscape-apps/blob/develop/desk/sur/channels.hoon#L195) | <code>.^(scan:c %gx /=channels=/chat/~sampel-palnet/mychat/search/text/0/10/~mister-hidden)</code>
| `/x/[kind]/[ship]/[name]/posts/...` | [channel-posts](https://github.com/tloncorp/landscape-apps/blob/develop/desk/mar/channel/posts.hoon) | Get posts from a channel. This can be called with a large variety of arguments, found [here](https://github.com/tloncorp/landscape-apps/blob/develop/desk/app/channels.hoon#L1044). Returns [paged-posts](https://github.com/tloncorp/landscape-apps/blob/develop/desk/sur/channels.hoon#L423) | <code>.^(scan:c %gx /=channels=/chat/~sampel-palnet/mychat/posts/newest/10/post</code>
| `/u/[kind]/[ship]/[name]` | loob | Check the existence of a channel | <code>.^(? %gu /=channels=/chat/~sampel-palnet/mychat/loob)</code>

## Pokes
All pokes here have the [channel-action](https://github.com/tloncorp/landscape-apps/blob/develop/desk/mar/channel/action.hoon) mark.

### Channels
| Description | Example
|-------------|--------
| Create a channel. This also updates the metadata in the `%groups` agent. See [$create-channel](https://github.com/tloncorp/landscape-apps/blob/develop/desk/sur/channels.hoon#L245) | <pre>=create-channel :\*<br>  %chat<br>  %mychat<br>  [our %mygroup]<br>  title='My chat channel'<br>  description='Chat about things'<br>  readers=\~<br>  writers=\~<br>==<br><br>:channels &channel-action [%create create-channel]</pre>
| Join a channel. In this example, `~sogrup` is the group host and `~hoster` is the channel host. | <pre>=nest [%chat \~hoster %mychat]<br>=action [%join group=[\~sogrup %mygroup]]<br><br>:channels &channel-action [%channel nest action]</pre>
| Leave a channel | <pre>=nest [%chat ~hoster %mychat]<br>=action [%leave ~]<br><br>:channels &channel-action [%channel nest action]</pre>
| Set the display format for a channel. See [$view](https://github.com/tloncorp/landscape-apps/blob/develop/desk/sur/channels.hoon#L186) | <pre>=nest [%chat our %mychat]<br>=action [%view %grid]<br><br>:channels &channel-action [%channel nest action]</pre>
| Set the sorting mechanism for a channel. See [$sort](https://github.com/tloncorp/landscape-apps/blob/develop/desk/sur/channels.hoon#L188) | <pre>=nest [%chat our %mychat]<br>=action [%sort %alpha]<br><br>:channels &channel-action [%channel nest action]</pre>
| Set manual post ordering for a channel. See [$arranged-notes](https://github.com/tloncorp/landscape-apps/blob/develop/desk/sur/channels.hoon#L190) | <pre>=nest [%chat our %mychat]<br>=action [%set-order `~[~2023.1.1 ~2023.2.2]]<br><br>:channels &channel-action [%channel nest action]</pre>
| Allow writing to a channel for certain roles. | <pre>=nest [%chat our %mychat]<br>=action [%add-writers (sy ~[%role1 %role2])]<br><br>:channels &channel-action [%channel nest action]</pre>
| Disallow writing to a diary for a certain set of roles. | <pre>=nest [%chat our %mychat]<br>=action [%del-writers (sy ~[%role1 %role2])]<br><br>:channels &channel-action [channel nest action]</pre>
| Pin channels | <pre>=pins ~[[%chat ~pinner %mychat]]<br><br>:channels &channel-action [%pin pins]</pre>

### Unreads
| Description | Example
|-------------|--------
| Mark a channel as read. | <pre>=nest [%chat our %mychat]<br>=action [%read ~]<br><br>:channels &channel-action [%channel nest action]</pre>
| Mark a channel as read up to a certain time. | <pre>=nest [%chat our %mychat]<br>=action [%read-at now]<br><br>:channels &channel-action [%channel nest action]</pre>
| *Currently unused*: Watch a channel for unreads. | <pre>=nest [%chat our %mychat]<br>=action [%watch ~]<br><br>:channels &channel-action [%channel nest action]</pre>
| *Currently unused*: Stop watching a channel for unreads. | <pre>=nest [%chat our %mychat]<br>=action [%unwatch ~]<br><br>:channels &channel-action [%channel nest action]</pre>

### Posts
| Description | Example
|-------------|--------
| Add a post to a channel. See [$post](https://github.com/tloncorp/landscape-apps/blob/develop/desk/sur/channels.hoon#L430). | <pre>=nest [%chat our %mychat]<br>=memo :\*<br>  ~[[%inline ~['hello world!']]]<br>  author=our<br>  sent=now<br>==<br>=kind-data [%chat ~]<br>=essay [memo kind-data]<br>=post-action [%add essay]<br>=action [%post post-action]<br><br>:channels &channel-action [%channel nest action]</pre>
| Edit a post in a channel. See [$post](https://github.com/tloncorp/landscape-apps/blob/develop/desk/sur/channels.hoon#L430). | <pre>=nest [%chat our %mychat]<br>=memo :*<br>  ~[[%inline ~['howdy world!']]]<br>  author=our<br>  sent=now<br>==<br>=kind-data [%chat ~]<br>=essay [memo kind-data]<br>=post-action [%edit ~2023.1.1 essay]<br>=action [%post post-action]<br><br>:channels &channel-action [%channel nest action]</pre>
| Delete a post. | <pre>=nest [%chat our %mychat]<br>=post-action [%del ~2023.1.1]<br>=action [%post post-action]<br><br>:channels &channel-action [%channel nest action]</pre>
| Add a reaction to a post. | <pre>=nest [%chat our %mychat]<br>=post-action [%add-react ~2023.1.1 our %':grinning:']<br>=action [%post post-action]<br><br>:channels &channel-action [%channel nest action]</pre>
| Remove a reaction from a post | <pre>=nest [%chat our %mychat]<br>=post-action [%del-react ~2023.1.1 our]<br>=action [%post post-action]<br><br>:channels &channel-action [%channel nest action]</pre>

### Replies
| Description | Example
|-------------|--------
| Add a reply to a post. See [$post](https://github.com/tloncorp/landscape-apps/blob/develop/desk/sur/channels.hoon#L430). | <pre>=nest [%chat our %mychat]<br>=memo :*<br>  ~[[%inline ~['howdy world!']]]<br>  author=our<br>  sent=now<br>==<br>=reply-action [%add memo]<br>=post-action [%reply ~2023.1.1 reply-action]<br>=action [%post post-action]<br><br>:channels &channel-action [%channel nest action]</pre>
| Delete a reply from a post. | <pre>=nest [%chat our %mychat]<br>=reply-action [%del ~2023.2.2]<br>=post-action [%reply ~2023.1.1 reply-action]<br>=action [%post post-action]<br><br>:channels &channel-action [%channel nest action]</pre>
| Add a reaction to a reply | <pre>=nest [%chat our %mychat]<br>=reply-action [%add-react ~2023.2.2 our %':grinning:']<br>=post-action [%reply ~2023.1.1 reply-action]<br>=action [%post post-action]<br><br>:channels &channel-action [%channel nest action]</pre>
| Delete a reaction from a reply | <pre>=nest [%chat our %mychat]<br>=reply-action [%del-react ~2023.2.2 our]<br>=post-action [%reply ~2023.1.1 reply-action]<br>=action [%post post-action]<br><br>:channels &channel-action [%channel nest action]</pre>
## Subscriptions
| Path | Marks | Description
|------|-------|-----------|
| `/unreads` | [channel-unread-update](https://github.com/tloncorp/landscape-apps/blob/develop/desk/mar/channel/unread-update.hoon) | Unread information. See [$unread](https://github.com/tloncorp/landscape-apps/blob/develop/desk/sur/channels.hoon#L219)
| `/` | [channel-response](https://github.com/tloncorp/landscape-apps/blob/develop/desk/mar/channel/response.hoon) | "Everything" subscription path. See [$r-channels](https://github.com/tloncorp/landscape-apps/blob/develop/desk/sur/channels.hoon#L378)
| `/[kind]/[ship]/[name]` | [channel-response](https://github.com/tloncorp/landscape-apps/blob/develop/desk/mar/channel/response.hoon) | Similar to `/`, but limited to a certain channel. See [$r-channels](https://github.com/tloncorp/landscape-apps/blob/develop/desk/sur/channels.hoon#L378)
| `/said/[kind]/[ship]/[name]/post/[time]/[(unit reply)]` | [channel-said](https://github.com/tloncorp/landscape-apps/blob/develop/desk/mar/channel/said.hoon) or [channel-denied](https://github.com/tloncorp/landscape-apps/blob/develop/desk/mar/channel/denied.hoon) | Read a reference. A `%channel-denied` fact means you cannot view the channel. See [$said](https://github.com/tloncorp/landscape-apps/blob/develop/desk/sur/channels.hoon#L201)
