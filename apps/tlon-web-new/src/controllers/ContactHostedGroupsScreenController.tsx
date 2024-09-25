import { ContactHostedGroupsScreen } from '@tloncorp/app/features/top/ContactHostedGroupsScreen';
import { useNavigate, useParams } from 'react-router';

export function ContactHostedGroupsScreenController() {
  const navigate = useNavigate();
  const { contactId } = useParams<{ contactId: string }>();

  return (
    <ContactHostedGroupsScreen
      contactId={contactId ?? ''}
      goBack={() => navigate(-1)}
    />
  );
}
