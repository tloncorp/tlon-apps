---
title: Logging and error handling
weight: "30"
---
# Logging and error handling

## Introduction

Logging is an indispensable tool for debugging issues arising in distributed server software running on a TM node. When a user reports a problem, logs on his node are consulted first to find the indicators of a possible issue in a running system. 
## Logging guidelines

In general, agent should log as much information as is required to quickly debug a problem. A good rule is: "when in doubt, log it!" It is better to include too much, rather than risk including too little, which could prevent a debugger from solving the issue.


## The "4L" rules of logging
1. Anything that is printed to the terminal should be logged.
2. All unexpected events should be logged. In particular, all agent crashes are considered critical, and should be logged.
3. It is worth judiciously logging information that would likely be useful when a problem arises. Many problems will not manifest as crashes.
4. Processes of special importance should always be logged, and should always have a debugging mode available that can be switched on demand. 

### 1. Log anything that is printed

If a developer decided to print something to the terminal, it is likely because he found it useful at some point for debugging or development. This can indicate that the information might one day prove useful to a debugger. It should therefore be logged at a suitable level. 

Information useful only in development should generally not be printed in production. If an exception arises, such messages should only log with a debug priority. 

### 2. Log anything that is unexpected

Any unexpected event in an agent should be logged. In particular, since agent crashes reported in `+on-fail` are unexpected and indicate a failure in operation, they should always be logged at a critical level.

Other unexpected events should generally be logged with a warning level, unless normal operation is prevented, where critical level should be used for reporting.

_what about received crashes. should they also be reported as critical_

### 3. Log all useful information

When things fail, even the tiniest bit of information can be worth more than gold. Agents should strive to make useful information available even during normal operation. Many bugs will not result in crashes, and then the information contained in the logs is the only way to make progress towards solving a problem.

### 4. Log all important processes

Processes which implement important features, or are otherwise important, should be strategically logged. They should also have a debugging mode available, which, when switched on demand, traces through every step of the processes, supplying useful information at each step.

## Logging priorities

### Critical level

All agent crashes should exclusively be reported at the critical level.

Events other than crashes can be reported at the critical level only if normal operation has been irrecoverably disrupted.

### Warning level

Events that indicate a potential problem should be reported at the warning level.

When a normal operation has been disrupted, but is going to be retried and succeed later, such event should be reported at the warning level.

### Info level

Events that do not qualify either for the critical or warning level, but could otherwise prove useful for a debugger in debugging a potential problem, should be reported at the info level, unless the reporting frequency would be overwhelming.

### Debug level

Any event not qualifying for three above level should only be reported at the debug level, which is only enabled on demand, and can be turned off.

## Crash specification

Since many crash events in an agent are logged as critical and have to be investigated, it is important to consider the circumstances when an agent can crash, and when a crash should be reported.

There are 10 arms in the gall agent interface. We discuss the desired crash behavior in turn for each of these arms.

### +on-init, +on-save, +on-load

These three arms deal, respectively, with agent initialization, agent suspension, and agent reloading. A crash in any of these three cases indicates a bug. A well-designed agent should never crash in any of these three arms.

In particular, a crash here can not be reported; gall will not call the `+on-fail` arm in any of these three cases, and such crash can only ever be diagnosed locally. 

### +on-poke

A successful operation should never crash. The agent should only crash on a poke if the operation can not be successfully completed,  or scheduled to complete.

Crashes in `+on-poke` are not reported to the `+on-fail` arm, and are therefore not considered critical by the publisher. They should still be reported at the client side as warnings to help diagnose possible problems.

It is worth noting that poking with a non-existent mark results in a failure, while the recipient `+on-poke` arm is not invoked. Such failures are likewise reported to the client as a poke nack.
### +on-watch

Incoming subscriptions arrive in the `+on-watch` arm. An agent will usually deny access by crashing. The crash in `+on-watch` is not reported locally, but is transmitted to the client as a watch nack.

In cases where the crash occurred due to a publisher-side bug, the logging of watch nacks at the client side will help diagnose the problem.
### +on-leave

The `+on-leave` arm is invoked when a client unsubscribes from a subscription path to notify the publisher about this fact. An agent should never crash in `+on-leave`. A crash here is reported in `+on-fail` and always indicates a bug.
### +on-peek

A call to `+on-peek` is a read request to the agent's namespace.
An agent should never crash in `+on-peek`, and a crash always indicates an application error. An agent should make proper use of the return value to indicate possible problems, such as a malformed path or a non-existent resource.

Crashes in `+on-peek` are not reported in the `+on-fail` arm, but manifest as crashes at the reader side.
### +on-agent

The `+on-agent` arm is called for incoming responses, which are either generated in response to a poke, or are subscription responses.

In general, the agent should know what it has asked for. Therefore, a crash in `+on-agent` arm indicates an unexpected response and therefore is a symptom of a problem that should be investigated.

Crashes in `+on-agent` are reported in the `+on-fail` arm.

### +on-arvo

Responses from the kernel arrive in the `+on-arvo` arm. As in `+on-agent` case, the agent should never willfully crash while handling responses from the kernel.

A crash in `+on-arvo` will trigger the `+on-fail` arm and always indicates a problem to be investigated.

### +on-fail

The `+on-fail` arm is called for crashes in specific arms in the agent. Only crashes in `+on-leave`, `+on-agent`, and `+on-arvo` trigger the `+on-fail` arm. In case of a crash, the arm receives as arguments the crash tag, indicating the origin arm of the crash, as well as the stacktrace.

It is enough to say that an agent should never crash in `+on-fail` handling. A crash here can only be diagnosed locally.
