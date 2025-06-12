---
title: TM Backend docs
---

# TM Backend docs 

TM backend infrastructure is deployed on the urbit platform. All TM backend components are located in the `groups` desk running on an urbit node. The desk source code can be found in the `desk` folder at [tlon-apps](https://github.com/tloncorp/tlon-apps) repository.

The `groups` desk is a provider of many agents, residing in the `/app` subdirectory, that together comprise TM backend. Apart from that, the desk also contains many utilities, such as libraries, marks, threads and unit tests. 

## Agents summary

Below we include a summary of all TM agents. The status column indicates whether the agent is running by default on all TM nodes (enabled or disabled), or whether it is running only on a select ship to provide the service (provider).

| Agent           | Description                    | Version | Status      |
| --------------- | ------------------------------ | ------- | ----------- |
| activity        | Notification service           | `%8`    | _enabled_   |
| bait            | Invite redemption service      | `%2`    | _provider_  |
| bark            | Provides fleet summaries       | `%0`    | _enabled_   |
| broadcaster     | Mass DMs                       | `%0`    | _provider_  |
| channels        | Channels client                | `%8`    | _enabled_   |
| channels-server | Channels host                  | `%8`    | _enabled_   |
| chat            | Direct messaging               | `%8`    | _enabled_   |
| contacts        | Profile and social graph       | `%2`    | _enabled_   |
| diary           | Notebook app                   | `%2`    | _enabled_   |
| expose          | Clearweb content rendering     | `%2`    | _disabled_  |
| genuine         | Fleet membership certification | `%0`    | _enabled_   |
| greeting        | Welcome page                   | `%0`    | _disabled_  |
| grouper         | Group lure link manager        | `%2`    | _enabled_   |
| groups          | Groups host and client         | `%5`    | _enabled_   |
| groups-ui       | Scry aggregator                | `%3`    | _enabled_   |
| growl           | Bark client                    | `%1`    | _enabled_   |
| heap            | Gallery app                    | `%1`    | _enabled_   |
| lanyard         | Verification client            | `%0`    | _enabled_   |
| logs            | Logging service                | `%0`    | _enabled_   |
| notify          | Notification provider          | `%7`    | _enabled_   |
| profile         | Public profile page            | `%1`    | _enabled_   |
| reel            | Bait client                    | `%4`    | _enabled_   |
| verifier        | Verification service           | `%1`    | _provider_  |




