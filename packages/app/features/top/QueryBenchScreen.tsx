import { toContactsData, toInitData } from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import type * as ub from '@tloncorp/shared/urbit';
import { Button, Text, View } from '@tloncorp/ui';
import { useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import contactsResponse from '../../../../packages/shared/src/test/contactBook.json';
import peersResponse from '../../../../packages/shared/src/test/contacts.json';
import initResponse from '../../../../packages/shared/src/test/init.json';
import suggestionsResponse from '../../../../packages/shared/src/test/suggestedContacts.json';

type BenchmarkCase = {
  id: string;
  label: string;
  run: () => Promise<unknown>;
};

type BenchmarkResult = {
  id: string;
  label: string;
  durationsMs: number[];
  averageMs: number;
};

const DEFAULT_ITERATIONS = 20;
const DEFAULT_GROUP_ID = '~dabben-larbet/tlon';
const DEFAULT_CHANNEL_ID = 'chat/~bolbex-fogdys/watercooler-4926';
const DEFAULT_POST_ID = '170.141.184.507.564.814.050.592.658.866.080.579.584';

export function QueryBenchScreen() {
  const [iterations, setIterations] = useState<number>(DEFAULT_ITERATIONS);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [runningIndividual, setRunningIndividual] = useState<Set<string>>(
    new Set()
  );
  const contactsData = useMemo(() => {
    return toContactsData({
      peersResponse,
      contactsResponse:
        contactsResponse as unknown as ub.ContactBookScryResult1,
      suggestionsResponse,
    });
  }, []);

  const benchmarkData = useMemo(() => {
    return toInitData(initResponse as unknown as ub.GroupsInit4);
  }, []);

  const cases: BenchmarkCase[] = useMemo(() => {
    return [
      // Settings
      {
        id: 'getSettings',
        label: 'getSettings()',
        run: () => db.getSettings(),
      },

      // Groups
      {
        id: 'getGroups-withRelations',
        label: 'getGroups (with relations)',
        run: () =>
          db.getGroups({
            includeLastPost: true,
            includeUnjoined: true,
            includeUnreads: true,
          }),
      },
      {
        id: 'getGroupPreviews',
        label: 'getGroupPreviews([])',
        run: () => db.getGroupPreviews([]),
      },
      {
        id: 'getJoinedGroupsCount',
        label: 'getJoinedGroupsCount()',
        run: () => db.getJoinedGroupsCount(),
      },
      {
        id: 'getGroupsWithMemberThreshold',
        label: 'getGroupsWithMemberThreshold(10)',
        run: () => db.getGroupsWithMemberThreshold(10),
      },
      {
        id: 'getUnjoinedGroupMeta',
        label: 'getUnjoinedGroupMeta()',
        run: () => db.getUnjoinedGroupMeta(),
      },
      {
        id: 'getUnjoinedGroups',
        label: 'getUnjoinedGroups()',
        run: () => db.getUnjoinedGroups(),
      },
      {
        id: 'getPersonalGroup',
        label: 'getPersonalGroup()',
        run: () => db.getPersonalGroup(),
      },

      // Analytics
      {
        id: 'getAnalyticsDigest',
        label: 'getAnalyticsDigest()',
        run: () => db.getAnalyticsDigest(),
      },

      // System Contacts
      {
        id: 'getSystemContacts',
        label: 'getSystemContacts()',
        run: () => db.getSystemContacts(),
      },
      {
        id: 'getSystemContactsBatchByContactId',
        label: 'getSystemContactsBatchByContactId([])',
        run: () => db.getSystemContactsBatchByContactId([]),
      },
      {
        id: 'getUninvitedSystemContactsShortlist',
        label: 'getUninvitedSystemContactsShortlist()',
        run: () => db.getUninvitedSystemContactsShortlist(),
      },

      // Attestations
      {
        id: 'getAttestations',
        label: 'getAttestations()',
        run: () => db.getAttestations(),
      },

      // Pins
      {
        id: 'getPins',
        label: 'getPins()',
        run: () => db.getPins(),
      },
      {
        id: 'getPinnedItems',
        label: 'getPinnedItems()',
        run: () => db.getPinnedItems(),
      },

      // Channels
      {
        id: 'getAllChannels',
        label: 'getAllChannels()',
        run: () => db.getAllChannels(),
      },
      {
        id: 'getAllMultiDms',
        label: 'getAllMultiDms()',
        run: () => db.getAllMultiDms(),
      },
      {
        id: 'getAllSingleDms',
        label: 'getAllSingleDms()',
        run: () => db.getAllSingleDms(),
      },

      // Chats
      {
        id: 'getChats',
        label: 'getChats()',
        run: () => db.getChats(),
      },

      // Roles
      {
        id: 'getAllGroupRoles',
        label: 'getAllGroupRoles()',
        run: () => db.getAllGroupRoles(),
      },

      // Unreads
      {
        id: 'getUnreadsCountWithoutMuted',
        label: 'getUnreadsCountWithoutMuted({})',
        run: () => db.getUnreadsCountWithoutMuted({}),
      },
      {
        id: 'getUnreads',
        label: 'getUnreads({})',
        run: () => db.getUnreads({}),
      },
      {
        id: 'getBaseUnread',
        label: 'getBaseUnread()',
        run: () => db.getBaseUnread(),
      },

      // Volume Settings
      {
        id: 'getVolumeExceptions',
        label: 'getVolumeExceptions()',
        run: () => db.getVolumeExceptions(),
      },

      // Posts
      // Only used in test, so don't need to include in benchmark.
      // {
      //   id: 'getPosts',
      //   label: 'getPosts()',
      //   run: () => db.getPosts(),
      // },
      {
        id: 'getHiddenPosts',
        label: 'getHiddenPosts()',
        run: () => db.getHiddenPosts(),
      },
      {
        id: 'getEnqueuedPosts',
        label: 'getEnqueuedPosts()',
        run: () => db.getEnqueuedPosts(),
      },

      // Contacts
      {
        id: 'getContacts',
        label: 'getContacts()',
        run: () => db.getContacts(),
      },
      {
        id: 'getContactsCount',
        label: 'getContactsCount()',
        run: () => db.getContactsCount(),
      },
      {
        id: 'getUserContacts',
        label: 'getUserContacts()',
        run: () => db.getUserContacts(),
      },
      {
        id: 'getSuggestedContacts',
        label: 'getSuggestedContacts()',
        run: () => db.getSuggestedContacts(),
      },
      {
        id: 'getBlockedUsers',
        label: 'getBlockedUsers()',
        run: () => db.getBlockedUsers(),
      },

      // Activity Events
      {
        id: 'getLatestActivityEvent',
        label: 'getLatestActivityEvent()',
        run: () => db.getLatestActivityEvent(),
      },
      {
        id: 'getBucketedActivity',
        label: 'getBucketedActivity()',
        run: () => db.getBucketedActivity(),
      },

      // Thread Unreads
      {
        id: 'getThreadUnreadsByChannel',
        label: 'getThreadUnreadsByChannel({ channelId: DEFAULT_CHANNEL_ID })',
        run: () =>
          db.getThreadUnreadsByChannel({ channelId: DEFAULT_CHANNEL_ID }),
      },

      // Channel Search
      {
        id: 'getChannelSearchResults',
        label:
          'getChannelSearchResults({ channelId: DEFAULT_CHANNEL_ID, postIds: [] })',
        run: () =>
          db.getChannelSearchResults({
            channelId: DEFAULT_CHANNEL_ID,
            postIds: [],
          }),
      },

      // Post Reactions
      {
        id: 'getPostReaction',
        label:
          'getPostReaction({ postId: DEFAULT_POST_ID, contactId: "test" })',
        run: () =>
          db.getPostReaction({ postId: DEFAULT_POST_ID, contactId: 'test' }),
      },

      // Individual Posts
      {
        id: 'getPost',
        label: 'getPost({ postId: DEFAULT_POST_ID })',
        run: () => db.getPost({ postId: DEFAULT_POST_ID }),
      },

      // Sequence Numbers
      {
        id: 'getLatestChannelSequenceNum',
        label: 'getLatestChannelSequenceNum({ channelId: DEFAULT_CHANNEL_ID })',
        run: () =>
          db.getLatestChannelSequenceNum({ channelId: DEFAULT_CHANNEL_ID }),
      },

      // Group Roles
      {
        id: 'getGroupRoles',
        label: 'getGroupRoles({ groupId: DEFAULT_GROUP_ID })',
        run: () => db.getGroupRoles({ groupId: DEFAULT_GROUP_ID }),
      },

      // Mention Events
      {
        id: 'getMentionEvents',
        label: 'getMentionEvents({ startCursor: null })',
        run: () => db.getMentionEvents({ startCursor: null }),
      },

      // INSERT BENCHMARKS (always available)
      {
        id: 'insertContacts',
        label: `insertContacts([${contactsData.length}])`,
        run: () => db.insertContacts(contactsData),
      },

      // INSERT BENCHMARKS
      {
        id: 'insertGroups',
        label: `insertGroups({ groups: [${benchmarkData.groups.length}] })`,
        run: () => db.insertGroups({ groups: benchmarkData.groups }),
      },
      {
        id: 'insertUnjoinedGroups',
        label: `insertUnjoinedGroups([${benchmarkData.unjoinedGroups.length}])`,
        run: () => db.insertUnjoinedGroups(benchmarkData.unjoinedGroups),
      },
      {
        id: 'insertChannels',
        label: `insertChannels([${benchmarkData.channels.length}])`,
        run: () => db.insertChannels(benchmarkData.channels),
      },
      {
        id: 'insertPinnedItems',
        label: `insertPinnedItems([${benchmarkData.pins.length}])`,
        run: () => db.insertPinnedItems(benchmarkData.pins),
      },
      {
        id: 'insertBlockedContacts',
        label: `insertBlockedContacts({ blockedIds: [${benchmarkData.blockedUsers.length}] })`,
        run: () =>
          db.insertBlockedContacts({
            blockedIds: benchmarkData.blockedUsers,
          }),
      },
      {
        id: 'persistUnreads',
        label: 'persistUnreads(benchmarkData.unreads)',
        run: () =>
          db
            .insertGroupUnreads(benchmarkData.unreads.groupUnreads)
            .then(() =>
              db.insertChannelUnreads(benchmarkData.unreads.channelUnreads)
            ),
      },
    ];
  }, [benchmarkData, contactsData]);

  const runBenchmarks = async () => {
    setIsRunning(true);
    setErrorMessage(null);
    const newResults: BenchmarkResult[] = [];
    try {
      for (const bench of cases) {
        const durations: number[] = [];
        for (let i = 0; i < iterations; i++) {
          const start = Date.now();
          await bench.run();
          durations.push(Date.now() - start);
          // wait 10ms between runs
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        const average =
          durations.reduce((a, b) => a + b, 0) / Math.max(1, durations.length);
        newResults.push({
          id: bench.id,
          label: bench.label,
          durationsMs: durations,
          averageMs: average,
        });
      }
      setResults(newResults);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsRunning(false);
    }
  };

  const runIndividualBenchmark = async (benchmarkCase: BenchmarkCase) => {
    setRunningIndividual((prev) => new Set([...prev, benchmarkCase.id]));
    setErrorMessage(null);

    try {
      const durations: number[] = [];
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await benchmarkCase.run();
        durations.push(Date.now() - start);
        // wait 10ms between runs
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      const average =
        durations.reduce((a, b) => a + b, 0) / Math.max(1, durations.length);

      const newResult: BenchmarkResult = {
        id: benchmarkCase.id,
        label: benchmarkCase.label,
        durationsMs: durations,
        averageMs: average,
      };

      setResults((prev) => {
        const filtered = prev.filter((r) => r.id !== benchmarkCase.id);
        return [...filtered, newResult];
      });
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRunningIndividual((prev) => {
        const newSet = new Set(prev);
        newSet.delete(benchmarkCase.id);
        return newSet;
      });
    }
  };

  const insets = useSafeAreaInsets();

  return (
    <View
      flex={1}
      backgroundColor="$background"
      padding="$l"
      paddingTop={insets.top}
      gap="$m"
    >
      <Text size="$label/xl">Query Benchmarks</Text>

      <View flexDirection="row" gap="$m" alignItems="center">
        <Button disabled={isRunning || !benchmarkData} onPress={runBenchmarks}>
          <Button.Text>{isRunning ? 'Running…' : `Run all`}</Button.Text>
        </Button>
        <Text color="$secondaryText" fontSize="$s">
          {iterations} iterations
        </Text>
        <Button
          disabled={isRunning}
          onPress={() => setIterations((n) => Math.max(1, n - 5))}
        >
          <Button.Text>-5</Button.Text>
        </Button>
        <Button
          disabled={isRunning}
          onPress={() => setIterations((n) => n + 5)}
        >
          <Button.Text>+5</Button.Text>
        </Button>
      </View>

      {!benchmarkData && !errorMessage && (
        <Text color="$secondaryText">
          Preparing INSERT benchmark data automatically using real init data...
          This transforms init.json data using toInitData() function.
        </Text>
      )}

      {errorMessage ? (
        <Text color="$negativeText">Error: {errorMessage}</Text>
      ) : null}

      <ScrollView style={{ flex: 1 }}>
        <View
          flexDirection="row"
          alignItems="center"
          paddingVertical="$m"
          paddingHorizontal="$m"
          borderBottomWidth={2}
          borderBottomColor="$border"
          backgroundColor="$secondaryBackground"
        >
          <View flex={4} marginRight="$m">
            <Text fontSize="$s" fontWeight="600" color="$secondaryText">
              Query
            </Text>
          </View>

          <View flex={2} alignItems="flex-end" marginRight="$m">
            <Text fontSize="$s" fontWeight="600" color="$secondaryText">
              Avg
            </Text>
          </View>

          <View flex={1} alignItems="flex-end">
            <Text fontSize="$s" fontWeight="600" color="$secondaryText">
              Run
            </Text>
          </View>
        </View>

        {cases
          .sort((a, b) => {
            const resultA = results.find((r) => r.id === a.id);
            const resultB = results.find((r) => r.id === b.id);
            if (resultA && resultB) {
              return resultB.averageMs - resultA.averageMs;
            }
            if (resultA && !resultB) return -1;
            if (!resultA && resultB) return 1;
            return 0;
          })
          .map((benchCase) => {
            const result = results.find((r) => r.id === benchCase.id);
            const isIndividualRunning = runningIndividual.has(benchCase.id);
            const isDisabled = isRunning || isIndividualRunning;

            return (
              <View
                key={benchCase.id}
                flexDirection="row"
                alignItems="center"
                paddingVertical="$s"
                paddingHorizontal="$m"
                borderBottomWidth={1}
                borderBottomColor="$border"
                backgroundColor={
                  result ? '$background' : '$secondaryBackground'
                }
              >
                <View flex={4} marginRight="$m">
                  <Text fontSize="$s" numberOfLines={1}>
                    {benchCase.label}
                  </Text>
                </View>

                <View flex={2} alignItems="flex-end" marginRight="$m">
                  {result ? (
                    <Text fontSize="$s" fontWeight="600">
                      {result.averageMs.toFixed(1)}ms
                    </Text>
                  ) : (
                    <Text fontSize="$xs" color="$tertiaryText">
                      —
                    </Text>
                  )}
                </View>

                <View flex={1} alignItems="flex-end">
                  <Button
                    disabled={isDisabled}
                    onPress={() => runIndividualBenchmark(benchCase)}
                  >
                    <Button.Text fontSize="$xs">
                      {isIndividualRunning ? '⏳' : '▶'}
                    </Button.Text>
                  </Button>
                </View>
              </View>
            );
          })}
      </ScrollView>
    </View>
  );
}
