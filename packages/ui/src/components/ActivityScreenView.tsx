import * as db from '@tloncorp/shared/dist/db';
import { SizableText } from 'tamagui';

export function ActivityScreenView({
  activityEvents,
}: {
  activityEvents: db.ActivityEvent[];
}) {
  return (
    <>
      {activityEvents.map((event) => {
        return <SizableText key={event.id}>{event.id}</SizableText>;
      })}
    </>
  );
}
