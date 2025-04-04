import * as db from '@tloncorp/shared/db';
import * as domain from '@tloncorp/shared/domain';
import { Pressable } from '@tloncorp/ui';

import { Field } from '../Form';
import { ListItem } from '../ListItem';
import { WidgetPane } from '../WidgetPane';

export function EditAttestationsDisplay(props: {
  attestations: db.Attestation[];
  onPressAttestation?: (attestation: 'phone' | 'twitter') => void;
}) {
  const twitterAttestation = props.attestations.find(
    (a) => a.type === 'twitter'
  );
  const phoneAttestation = props.attestations.find((a) => a.type === 'phone');

  return (
    <Field label="Connected Accounts">
      <WidgetPane editor>
        <Pressable onPress={() => props.onPressAttestation?.('twitter')}>
          <ListItem>
            <ListItem.MainContent>
              <ListItem.Title>𝕏 Account</ListItem.Title>
              {twitterAttestation && (
                <ListItem.Subtitle>
                  @{twitterAttestation.value}
                  {'    '}
                  <ListItem.Subtitle
                    color={
                      twitterAttestation.status === 'verified'
                        ? '$positiveActionText'
                        : 'unset'
                    }
                  >
                    {twitterAttestation.status === 'verified'
                      ? 'Verified'
                      : 'In Progress'}
                  </ListItem.Subtitle>
                </ListItem.Subtitle>
              )}
            </ListItem.MainContent>
            <ListItem.EndContent>
              <ListItem.SystemIcon
                backgroundColor="unset"
                icon="ChevronRight"
              />
            </ListItem.EndContent>
          </ListItem>
        </Pressable>
        <Pressable onPress={() => props.onPressAttestation?.('phone')}>
          <ListItem>
            <ListItem.MainContent>
              <ListItem.Title>Phone</ListItem.Title>
              {phoneAttestation && (
                <ListItem.Subtitle>
                  {phoneAttestation.value &&
                    domain.displayablePhoneNumber(phoneAttestation.value)}
                  {'    '}
                  <ListItem.Subtitle
                    color={
                      phoneAttestation.status === 'verified'
                        ? '$positiveActionText'
                        : 'unset'
                    }
                  >
                    {phoneAttestation.status === 'verified'
                      ? 'Verified'
                      : 'In Progress'}
                  </ListItem.Subtitle>
                </ListItem.Subtitle>
              )}
            </ListItem.MainContent>
            <ListItem.EndContent>
              <ListItem.SystemIcon
                backgroundColor="unset"
                icon="ChevronRight"
              />
            </ListItem.EndContent>
          </ListItem>
        </Pressable>
      </WidgetPane>
    </Field>
  );
}
